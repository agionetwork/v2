import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { TOKEN_MINTS, TOKEN_DECIMALS, getTokenProgram, resolveTokenProgram } from "@/lib/token-mints"
import { LoanStatus, calculateFullRepayAmount } from "@/lib/loan-utils"
import { getAgentConfig, getAgentPublicKey, appendAgentAction, getLastAirdropTime, setLastAirdropTime, isAirdropCooldownExpired, getOwnerByAgentPublicKey } from "./redis"
import { signAndSendTransaction } from "./privy"
import { createPrivateLendOfferAsAgent, createPrivateBorrowRequestAsAgent } from "./private-flow"
import { executeSwap } from "./jupiter"
import {
  fetchAllLoans,
  filterPendingBorrowRequests,
  filterPendingLendOffers,
  filterExpiredLoans,
  filterLoansToRepay,
  filterPendingLendOffersByAgent,
  filterPendingBorrowRequestsByAgent,
  matchLoanToConfig,
} from "./loan-scanner"
import { fetchTokenPrices, PYTH_FEED_IDS } from "@/lib/token-prices"
import { postPriceUpdatesForMints } from "@/lib/pyth-poster"
import { searchProfiles, getReceivedFriendRequests, acceptFriendRequest } from "@/lib/tapestry-server"
import {
  buildAcceptBorrowRequestTx,
  buildAcceptLendOfferTx,
  buildForecloseLoanTx,
  buildRepayLoanTx,
  buildCreateLendOfferTx,
  buildCreateBorrowRequestTx,
  buildRescindBorrowOfferTx,
  buildRescindLendOfferTx,
} from "./transaction-builder"
import {
  notifyLoanAccepted, notifyLoanRepaid, notifyLoanForeclosed,
  notifyNetworkLoanCreated, notifyFriendAccepted,
} from "@/lib/dialect"
import { SOLANA_CLUSTER } from "@/config/solana"
import { SECURITY_CONFIG } from "@/lib/security-config"
import type { AgentAction } from "./types"

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    // Include cause chain for Anchor/web3 errors
    let msg = err.message
    if (err.cause) msg += ` [cause: ${errMsg(err.cause)}]`
    return msg
  }
  if (typeof err === "string") return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

// In-memory lock to prevent concurrent cycles for the same wallet
const runningCycles = new Set<string>()

// Throttle scan diagnostic logs — only log once per 30 seconds per wallet
const lastScanLog = new Map<string, number>()

async function logAction(userWallet: string, action: AgentAction) {
  try {
    await appendAgentAction(userWallet, action)
  } catch (err) {
    console.error("Failed to log agent action:", err)
  }
}

async function resolveProfileIdForAgent(userWallet: string): Promise<string | null> {
  try {
    const result = await searchProfiles(userWallet, 1, 0)
    return result.profiles[0]?.profile?.id || null
  } catch {
    return null
  }
}

function shouldLogScan(key: string): boolean {
  const now = Date.now()
  const last = lastScanLog.get(key) || 0
  if (now - last < 30_000) return false // throttle to once per 30s
  lastScanLog.set(key, now)
  return true
}

async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  tokenSymbol: string,
): Promise<number> {
  try {
    if (tokenSymbol === "SOL") {
      const balance = await connection.getBalance(wallet)
      return balance / 1e9
    }
    const mint = TOKEN_MINTS[tokenSymbol]
    if (!mint) return 0

    // Dynamically resolve the token program from the on-chain mint account
    const tokenProgramId = await resolveTokenProgram(connection, mint)

    // For Token-2022 mints, check default derivation first — most wallets use it
    if (!tokenProgramId.equals(TOKEN_PROGRAM_ID)) {
      try {
        const defaultAta = getAssociatedTokenAddressSync(mint, wallet, true)
        const balance = await connection.getTokenAccountBalance(defaultAta)
        if (balance.value.uiAmount) return balance.value.uiAmount
      } catch { /* default ATA doesn't exist, try canonical */ }
    }

    const ata = getAssociatedTokenAddressSync(mint, wallet, true, tokenProgramId)
    const balance = await connection.getTokenAccountBalance(ata)
    return balance.value.uiAmount || 0
  } catch {
    return 0
  }
}

export async function executeAgentCycle(userWallet: string): Promise<void> {
  // Prevent concurrent cycles for the same wallet
  if (runningCycles.has(userWallet)) return
  runningCycles.add(userWallet)

  try {
    await runCycle(userWallet)
  } finally {
    runningCycles.delete(userWallet)
  }
}

async function runCycle(userWallet: string): Promise<void> {
  const config = await getAgentConfig(userWallet)
  if (!config || !config.enabled) return

  const agentPubkeyStr = await getAgentPublicKey(userWallet)
  if (!agentPubkeyStr) return

  const agentPubkey = new PublicKey(agentPubkeyStr)
  const connection = createConnection()
  const program = createReadonlyProgram(connection)

  // 0. Auto-airdrop SOL on devnet when balance is too low
  if (SOLANA_CLUSTER === "devnet") {
    try {
      const solBalance = await connection.getBalance(agentPubkey)
      const solBalanceUi = solBalance / LAMPORTS_PER_SOL
      const MIN_SOL_THRESHOLD = 0.05 // need at least this for tx fees

      if (solBalanceUi < MIN_SOL_THRESHOLD) {
        const lastAirdrop = await getLastAirdropTime(userWallet)
        if (isAirdropCooldownExpired(lastAirdrop)) {
          try {
            const airdropSig = await connection.requestAirdrop(agentPubkey, 2 * LAMPORTS_PER_SOL)
            await connection.confirmTransaction(airdropSig)
            await setLastAirdropTime(userWallet)

            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "airdrop",
              details: `Airdropped 2 SOL (balance was ${solBalanceUi.toFixed(4)} SOL)`,
              txHash: airdropSig,
              status: "success",
            })
          } catch (err) {
            // Record attempt time even on failure to respect cooldown
            await setLastAirdropTime(userWallet)

            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "airdrop",
              details: `Airdrop failed (will retry in 10h): ${errMsg(err)}`.slice(0, 500),
              txHash: null,
              status: "error",
            })
          }
        } else {
          const hoursRemaining = ((10 * 60 * 60 * 1000 - (Date.now() - lastAirdrop)) / 3600000).toFixed(1)
          if (shouldLogScan(`${userWallet}:airdrop`)) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "scan",
              details: `Airdrop cooldown: ${hoursRemaining}h remaining (balance ${solBalanceUi.toFixed(4)} SOL)`,
              txHash: null,
              status: "success",
            })
          }
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Airdrop check error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // Single RPC call — fetch all loans once for the entire cycle
  let allLoans
  try {
    allLoans = await fetchAllLoans(program)
  } catch (err) {
    await logAction(userWallet, {
      timestamp: new Date().toISOString(),
      type: "error",
      details: `Fetch loans failed: ${errMsg(err)}`.slice(0, 500),
      txHash: null,
      status: "error",
    })
    throw err // propagate so client knows to backoff
  }

  // Fetch token prices for USD-based amount/collateral checks
  const tokenPrices = await fetchTokenPrices()

  // Balance cache: fetch each token balance once per cycle, not per candidate
  const balanceCache = new Map<string, number>()
  async function getCachedBalance(tokenSymbol: string): Promise<number> {
    if (balanceCache.has(tokenSymbol)) return balanceCache.get(tokenSymbol)!
    const bal = await getTokenBalance(connection, agentPubkey, tokenSymbol)
    balanceCache.set(tokenSymbol, bal)
    return bal
  }

  // 0. Cleanup legacy self-lent loans (lender == borrower, created before SEC-001)
  {
    const selfLentLoans = allLoans.filter(
      (loan) =>
        loan.lender &&
        loan.borrower &&
        loan.lender.toLowerCase() === loan.borrower.toLowerCase() &&
        loan.borrower.toLowerCase() === agentPubkeyStr.toLowerCase() &&
        loan.status === LoanStatus.Accepted,
    )
    for (const loan of selfLentLoans) {
      try {
        const tx = await buildRepayLoanTx(connection, program, agentPubkey, loan, loan.debtAmountUi)
        await signAndSendTransaction(userWallet, tx)
        await logAction(userWallet, {
          timestamp: new Date().toISOString(),
          type: "repaid_loan",
          details: `Cleaned up self-lent loan ${loan.publicKey} (${loan.debtAmountUi} ${loan.debtTokenSymbol})`,
          txHash: null,
          status: "success",
        })
      } catch (err) {
        await logAction(userWallet, {
          timestamp: new Date().toISOString(),
          type: "error",
          details: `Failed to clean self-lent loan ${loan.publicKey}: ${errMsg(err)}`.slice(0, 500),
          txHash: null,
          status: "error",
        })
      }
    }
  }

  // 1. Lending: accept pending borrow requests
  if (config.lendEnabled) {
    try {
      const borrowRequests = filterPendingBorrowRequests(allLoans)

      const skips: string[] = []
      const candidates: typeof borrowRequests = []

      for (const loan of borrowRequests) {
        if (loan.borrower?.toLowerCase() === agentPubkeyStr.toLowerCase()) {
          continue // skip self
        }

        const skipReason = matchLoanToConfig(loan, config, "lend", tokenPrices)
        if (skipReason) {
          skips.push(`${loan.debtAmountUi} ${loan.debtTokenSymbol}: ${skipReason}`)
          continue
        }

        let balance = await getCachedBalance(loan.debtTokenSymbol)
        if (balance < loan.debtAmountUi) {
          // Auto-rebalance: try to swap SOL→debtToken via Jupiter if enabled
          if (config.swapEnabled && config.swapAutoRebalance && loan.debtTokenSymbol !== "SOL") {
            const solBalance = await getCachedBalance("SOL")
            const deficit = loan.debtAmountUi - balance
            // Reserve 0.05 SOL for tx fees
            if (solBalance > 0.05) {
              try {
                const swapAmountSol = Math.min(solBalance - 0.05, deficit * 2) // swap enough + buffer
                const rawAmount = Math.round(swapAmountSol * 1e9)
                const swapResult = await executeSwap(
                  userWallet,
                  "SOL",
                  loan.debtTokenSymbol,
                  rawAmount,
                  config.swapSlippageBps || 50,
                )
                balanceCache.delete(loan.debtTokenSymbol) // invalidate cache
                balanceCache.delete("SOL")
                balance = await getCachedBalance(loan.debtTokenSymbol)
                await logAction(userWallet, {
                  timestamp: new Date().toISOString(),
                  type: "swapped_tokens",
                  details: `Auto-rebalance: swapped SOL → ${loan.debtTokenSymbol} via Jupiter`,
                  txHash: swapResult.txSignature,
                  status: "success",
                })
              } catch (swapErr) {
                await logAction(userWallet, {
                  timestamp: new Date().toISOString(),
                  type: "error",
                  details: `Auto-rebalance swap failed: ${errMsg(swapErr)}`,
                  txHash: null,
                  status: "error",
                })
              }
            }
          }
          if (balance < loan.debtAmountUi) {
            skips.push(`${loan.debtAmountUi} ${loan.debtTokenSymbol}: insufficient balance (${balance})`)
            continue
          }
        }

        candidates.push(loan)
      }

      // Sort by best return: highest APY first, then shortest duration
      candidates.sort((a, b) => {
        if (b.apy !== a.apy) return b.apy - a.apy
        return a.duration - b.duration
      })

      // Accept the best offer
      if (candidates.length > 0) {
        const loan = candidates[0]
        try {
          // Post Pyth price updates (required by on-chain accept instruction)
          const botKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(process.env.FORECLOSURE_BOT_KEYPAIR || "[]"))
          )
          const collateralFeedId = PYTH_FEED_IDS[loan.collateralTokenSymbol]
          const debtFeedId = PYTH_FEED_IDS[loan.debtTokenSymbol]
          if (!collateralFeedId || !debtFeedId) throw new Error(`No Pyth feed for ${loan.collateralTokenSymbol}/${loan.debtTokenSymbol}`)
          const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
            connection, botKeypair, [...new Set([collateralFeedId, debtFeedId])]
          )

          let txHash: string
          try {
            const serializedTx = await buildAcceptBorrowRequestTx(
              connection,
              program,
              agentPubkey,
              loan,
              {
                collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                debtPriceUpdate: priceUpdateAccounts[debtFeedId],
              },
            )
            txHash = await signAndSendTransaction(userWallet, serializedTx)
          } finally {
            cleanup().catch(() => {})
          }

          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "accepted_borrow_request",
            details: `Lent ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY (best of ${candidates.length})`,
            txHash,
            status: "success",
          })

          // Notify borrower their request was accepted (fire-and-forget)
          if (loan.borrower) {
            const borrowerWallet = (await getOwnerByAgentPublicKey(loan.borrower)) || loan.borrower
            notifyLoanAccepted(borrowerWallet, {
              debtToken: loan.debtTokenSymbol, amount: loan.debtAmountUi,
              apy: loan.apy, loanType: "borrow request",
            }).catch(() => {})
          }
        } catch (err) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "error",
            details: `Failed to accept borrow request: ${errMsg(err)}`,
            txHash: null,
            status: "error",
          })
        }
      }

      // Log diagnostic summary (throttled to once per 30s)
      if (shouldLogScan(`${userWallet}:lend`)) {
        await logAction(userWallet, {
          timestamp: new Date().toISOString(),
          type: "scan",
          details: skips.length > 0
            ? `Lend: ${borrowRequests.length} offers, ${candidates.length} matched, ${skips.length} skipped — ${skips.join("; ")}`.slice(0, 500)
            : `Lend: ${borrowRequests.length} borrow requests found, ${candidates.length} matched, 0 skipped`,
          txHash: null,
          status: "success",
        })
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Lend scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 2. Borrowing: accept pending lend offers
  if (config.borrowEnabled) {
    try {
      const lendOffers = filterPendingLendOffers(allLoans)

      const skips: string[] = []
      const candidates: typeof lendOffers = []

      for (const loan of lendOffers) {
        if (loan.lender?.toLowerCase() === agentPubkeyStr.toLowerCase()) {
          continue // skip self
        }

        const skipReason = matchLoanToConfig(loan, config, "borrow", tokenPrices)
        if (skipReason) {
          skips.push(`${loan.debtAmountUi} ${loan.debtTokenSymbol}: ${skipReason}`)
          continue
        }

        const collateralBalance = await getCachedBalance(loan.collateralTokenSymbol)
        if (collateralBalance < loan.collateralAmountUi) {
          skips.push(`${loan.debtAmountUi} ${loan.debtTokenSymbol}: insufficient collateral (${collateralBalance} ${loan.collateralTokenSymbol})`)
          continue
        }

        candidates.push(loan)
      }

      // Sort by best deal: lowest APY first, then shortest duration
      candidates.sort((a, b) => {
        if (a.apy !== b.apy) return a.apy - b.apy
        return a.duration - b.duration
      })

      // Accept the best offer
      if (candidates.length > 0) {
        const loan = candidates[0]
        try {
          // Post Pyth price updates (required by on-chain accept instruction)
          const botKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(process.env.FORECLOSURE_BOT_KEYPAIR || "[]"))
          )
          const collateralFeedId = PYTH_FEED_IDS[loan.collateralTokenSymbol]
          const debtFeedId = PYTH_FEED_IDS[loan.debtTokenSymbol]
          if (!collateralFeedId || !debtFeedId) throw new Error(`No Pyth feed for ${loan.collateralTokenSymbol}/${loan.debtTokenSymbol}`)
          const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
            connection, botKeypair, [...new Set([collateralFeedId, debtFeedId])]
          )

          let txHash: string
          try {
            const serializedTx = await buildAcceptLendOfferTx(
              connection,
              program,
              agentPubkey,
              loan,
              {
                collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                debtPriceUpdate: priceUpdateAccounts[debtFeedId],
              },
            )
            txHash = await signAndSendTransaction(userWallet, serializedTx)
          } finally {
            cleanup().catch(() => {})
          }

          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "accepted_lend_offer",
            details: `Borrowed ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY (best of ${candidates.length})`,
            txHash,
            status: "success",
          })

          // Notify lender their offer was accepted (fire-and-forget)
          if (loan.lender) {
            const lenderWallet = (await getOwnerByAgentPublicKey(loan.lender)) || loan.lender
            notifyLoanAccepted(lenderWallet, {
              debtToken: loan.debtTokenSymbol, amount: loan.debtAmountUi,
              apy: loan.apy, loanType: "lend offer",
            }).catch(() => {})
          }
        } catch (err) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "error",
            details: `Failed to accept lend offer: ${errMsg(err)}`,
            txHash: null,
            status: "error",
          })
        }
      }

      // Log diagnostic summary (throttled to once per 30s)
      if (shouldLogScan(`${userWallet}:borrow`)) {
        await logAction(userWallet, {
          timestamp: new Date().toISOString(),
          type: "scan",
          details: skips.length > 0
            ? `Borrow: ${lendOffers.length} offers, ${candidates.length} matched, ${skips.length} skipped — ${skips.join("; ")}`.slice(0, 500)
            : `Borrow: ${lendOffers.length} lend offers found, ${candidates.length} matched, 0 skipped`,
          txHash: null,
          status: "success",
        })
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Borrow scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 3. Auto-foreclose expired loans (agent is lender)
  if (config.lendEnabled) {
    try {
      const expired = filterExpiredLoans(allLoans, agentPubkeyStr)

      for (const loan of expired) {
        try {
          const serializedTx = await buildForecloseLoanTx(
            connection,
            program,
            agentPubkey,
            loan,
          )
          const txHash = await signAndSendTransaction(userWallet, serializedTx)

          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "foreclosed_loan",
            details: `Foreclosed loan: ${loan.debtAmountUi} ${loan.debtTokenSymbol}`,
            txHash,
            status: "success",
          })

          // Notify borrower their loan was foreclosed (fire-and-forget)
          if (loan.borrower) {
            const borrowerWallet = (await getOwnerByAgentPublicKey(loan.borrower)) || loan.borrower
            notifyLoanForeclosed(borrowerWallet, {
              debtToken: loan.debtTokenSymbol, amount: loan.debtAmountUi,
            }).catch(() => {})
          }
        } catch (err) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "error",
            details: `Failed to foreclose: ${errMsg(err)}`,
            txHash: null,
            status: "error",
          })
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Foreclose scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 3b. Auto-rescind agent's own under-collateralized pending offers
  {
    try {
      const prices = await fetchTokenPrices()
      const MIN_RATIO = SECURITY_CONFIG.VALIDATION.MIN_ACCEPT_COLLATERAL_RATIO

      // Agent's lend offers (agent is lender, locked debt) → rescind via rescindBorrowOffer
      const agentLendOffers = filterPendingLendOffersByAgent(allLoans, agentPubkeyStr)
      // Agent's borrow requests (agent is borrower, locked collateral) → rescind via rescindLendOffer
      const agentBorrowRequests = filterPendingBorrowRequestsByAgent(allLoans, agentPubkeyStr)

      for (const loan of [...agentLendOffers, ...agentBorrowRequests]) {
        const colPrice = prices[loan.collateralTokenSymbol] || 0
        const debtPrice = prices[loan.debtTokenSymbol] || 0
        if (colPrice === 0 || debtPrice === 0) continue
        const colValueUsd = loan.collateralAmountUi * colPrice
        const debtValueUsd = loan.debtAmountUi * debtPrice
        const ratio = debtValueUsd > 0 ? (colValueUsd / debtValueUsd) * 100 : 0
        if (ratio >= MIN_RATIO) continue

        try {
          const isAgentLender = loan.lender?.toLowerCase() === agentPubkeyStr.toLowerCase()
          const serializedTx = isAgentLender
            ? await buildRescindBorrowOfferTx(connection, program, agentPubkey, loan)
            : await buildRescindLendOfferTx(connection, program, agentPubkey, loan)
          const txHash = await signAndSendTransaction(userWallet, serializedTx)

          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "rescinded_offer",
            details: `Auto-rescinded under-collateralized ${loan.offerType} offer (ratio ${ratio.toFixed(1)}% < ${MIN_RATIO}%): ${loan.debtAmountUi} ${loan.debtTokenSymbol}`,
            txHash,
            status: "success",
          })
        } catch (err) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "error",
            details: `Failed to auto-rescind under-collateralized offer: ${errMsg(err)}`,
            txHash: null,
            status: "error",
          })
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Auto-rescind scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 4. Auto-repay loans close to expiry (agent is borrower)
  if (config.borrowEnabled) {
    try {
      const toRepay = filterLoansToRepay(allLoans, agentPubkeyStr)

      for (const loan of toRepay) {
        // Balance check: borrower needs principal + interest (program transfers both on full repay)
        const totalOwed = calculateFullRepayAmount(loan)
        const debtBalance = await getCachedBalance(loan.debtTokenSymbol)
        if (debtBalance < totalOwed) continue

        try {
          // On-chain repay_amount must be <= debt_amount (remaining principal).
          // The program adds interest internally. Builder also caps as safety net.
          const serializedTx = await buildRepayLoanTx(
            connection,
            program,
            agentPubkey,
            loan,
            loan.debtAmountUi,
          )
          const txHash = await signAndSendTransaction(userWallet, serializedTx)

          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "repaid_loan",
            details: `Repaid ${totalOwed.toFixed(4)} ${loan.debtTokenSymbol} (principal: ${loan.debtAmountUi}, interest included)`,
            txHash,
            status: "success",
          })

          // Notify lender their loan was repaid (fire-and-forget)
          if (loan.lender) {
            const lenderWallet = (await getOwnerByAgentPublicKey(loan.lender)) || loan.lender
            notifyLoanRepaid(lenderWallet, {
              debtToken: loan.debtTokenSymbol, amount: loan.debtAmountUi,
            }).catch(() => {})
          }
        } catch (err) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "error",
            details: `Failed to repay: ${errMsg(err)}`,
            txHash: null,
            status: "error",
          })
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Repay scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 5. Auto-accept pending friend requests (default true for agents created before this field existed)
  if (config.socialAutoAcceptFriends !== false) {
    try {
      const profileId = await resolveProfileIdForAgent(userWallet)
      if (profileId) {
        const pending = await getReceivedFriendRequests(profileId, "pending")
        for (const req of pending) {
          try {
            await acceptFriendRequest(req.contentId, req.pairContentId, profileId, req.senderProfileId)
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "accepted_friend_request",
              details: `Accepted friend request from ${req.senderWallet.slice(0, 8)}...`,
              txHash: null,
              status: "success",
            })

            // Notify sender their request was accepted (fire-and-forget)
            if (req.senderWallet) {
              notifyFriendAccepted(req.senderWallet, profileId).catch(() => {})
            }
          } catch (err) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "error",
              details: `Failed to accept friend request: ${errMsg(err)}`,
              txHash: null,
              status: "error",
            })
          }
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Friend request scan error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 6. Auto-create lend offers (agent creates an offer for others to borrow from)
  if (config.lendEnabled && config.lendAutoCreateOffers) {
    try {
      const existingOffers = filterPendingLendOffersByAgent(allLoans, agentPubkeyStr)
      if (existingOffers.length > 0) {
        if (shouldLogScan(`${userWallet}:create-lend`)) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "scan",
            details: `Create lend: skipped — ${existingOffers.length} pending offer(s) already exist`,
            txHash: null,
            status: "success",
          })
        }
      } else {
        const debtTokenSymbol = config.lendTokens[0] || "USDC"
        const collateralTokenSymbol = config.lendAcceptedCollateral[0] || "SOL"

        const debtPrice = tokenPrices[debtTokenSymbol] ?? 1
        const debtAmount = Math.max(config.lendMinAmountUsd / debtPrice, 0.01)

        // Protocol floor: ensure collateral ratio and APY meet protocol limits
        const effectiveRatio = Math.max(config.lendMinCollateralRatio, SECURITY_CONFIG.VALIDATION.MIN_COLLATERAL_RATIO)
        const collateralPrice = tokenPrices[collateralTokenSymbol] ?? 1
        const collateralValueNeeded = (debtAmount * debtPrice * effectiveRatio) / 100
        const collateralAmount = collateralValueNeeded / collateralPrice

        const apy = Math.min(config.lendMinApy, SECURITY_CONFIG.VALIDATION.MAX_APY)
        const duration = config.lendMaxDuration * 86400

        const debtBalance = await getCachedBalance(debtTokenSymbol)
        const solBalance = await getCachedBalance("SOL")
        const FEE_BUFFER = 0.01

        if (debtBalance < debtAmount) {
          if (shouldLogScan(`${userWallet}:create-lend`)) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "scan",
              details: `Create lend: insufficient ${debtTokenSymbol} (${debtBalance.toFixed(2)} < ${debtAmount.toFixed(2)})`,
              txHash: null,
              status: "success",
            })
          }
        } else if (solBalance < FEE_BUFFER) {
          if (shouldLogScan(`${userWallet}:create-lend`)) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "scan",
              details: `Create lend: insufficient SOL for fees (${solBalance.toFixed(4)})`,
              txHash: null,
              status: "success",
            })
          }
        } else {
          try {
            // Post Pyth price updates for on-chain collateral ratio validation
            const botKeypair = Keypair.fromSecretKey(
              Uint8Array.from(JSON.parse(process.env.FORECLOSURE_BOT_KEYPAIR || "[]"))
            )
            const collateralFeedId = PYTH_FEED_IDS[collateralTokenSymbol]
            const debtFeedId = PYTH_FEED_IDS[debtTokenSymbol]
            if (!collateralFeedId || !debtFeedId) throw new Error(`No Pyth feed for ${collateralTokenSymbol}/${debtTokenSymbol}`)
            const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
              connection, botKeypair, [...new Set([collateralFeedId, debtFeedId])]
            )

            let txHash: string
            let stealthPubkey: string | undefined
            try {
              if (config.privacyEnabled) {
                const result = await createPrivateLendOfferAsAgent({
                  ownerWallet: userWallet,
                  agentWallet: agentPubkeyStr,
                  debtTokenSymbol,
                  collateralTokenSymbol,
                  debtAmount,
                  collateralAmount,
                  duration,
                  apy,
                  priceUpdates: {
                    collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                    debtPriceUpdate: priceUpdateAccounts[debtFeedId],
                  },
                })
                txHash = result.txHash
                stealthPubkey = result.stealthPublicKey
              } else {
                const serializedTx = await buildCreateLendOfferTx(
                  connection,
                  program,
                  agentPubkey,
                  { debtTokenSymbol, collateralTokenSymbol, debtAmount, collateralAmount, duration, apy },
                  {
                    collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                    debtPriceUpdate: priceUpdateAccounts[debtFeedId],
                  },
                )
                txHash = await signAndSendTransaction(userWallet, serializedTx)
              }
            } finally {
              cleanup().catch(() => {})
            }
            balanceCache.delete(debtTokenSymbol)

            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "created_lend_offer",
              details:
                `Created ${config.privacyEnabled ? "private " : ""}lend offer: ` +
                `${debtAmount.toFixed(2)} ${debtTokenSymbol} at ${apy}% APY, ${duration}s, ` +
                `collateral ${collateralAmount.toFixed(4)} ${collateralTokenSymbol}` +
                (stealthPubkey ? ` (stealth ${stealthPubkey.slice(0, 8)}...)` : ""),
              txHash,
              status: "success",
            })

            // Notify followers of new offer (fire-and-forget)
            notifyNetworkLoanCreated(userWallet, {
              debtToken: debtTokenSymbol, amount: debtAmount,
              apy, loanType: "lend offer",
            }).catch(() => {})
          } catch (err) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "error",
              details: `Failed to create lend offer: ${errMsg(err)}`,
              txHash: null,
              status: "error",
            })
          }
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Create lend offer error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }

  // 7. Auto-create borrow requests (agent creates a request for others to lend to)
  if (config.borrowEnabled && config.borrowAutoCreateRequests) {
    try {
      const existingRequests = filterPendingBorrowRequestsByAgent(allLoans, agentPubkeyStr)
      if (existingRequests.length > 0) {
        if (shouldLogScan(`${userWallet}:create-borrow`)) {
          await logAction(userWallet, {
            timestamp: new Date().toISOString(),
            type: "scan",
            details: `Create borrow: skipped — ${existingRequests.length} pending request(s) already exist`,
            txHash: null,
            status: "success",
          })
        }
      } else {
        const debtTokenSymbol = config.borrowTokens[0] || "USDC"
        const collateralTokenSymbol = config.borrowCollateralTokens[0] || "SOL"

        const debtPrice = tokenPrices[debtTokenSymbol] ?? 1
        const debtAmount = Math.max(config.borrowMinAmountUsd / debtPrice, 0.01)

        // Protocol floor: ensure collateral ratio and APY meet protocol limits
        const effectiveBorrowRatio = Math.max(config.borrowMinCollateralRatio, SECURITY_CONFIG.VALIDATION.MIN_COLLATERAL_RATIO)
        const collateralPrice = tokenPrices[collateralTokenSymbol] ?? 1
        const collateralValueNeeded = (debtAmount * debtPrice * effectiveBorrowRatio) / 100
        const collateralAmount = collateralValueNeeded / collateralPrice

        const apy = Math.min(config.borrowMaxApy, SECURITY_CONFIG.VALIDATION.MAX_APY)
        const duration = config.borrowMaxDuration * 86400

        const collateralBalance = await getCachedBalance(collateralTokenSymbol)
        const solBalance = await getCachedBalance("SOL")
        const FEE_BUFFER = 0.01

        // For SOL collateral, reserve fee buffer from the same balance
        const effectiveCollateralBalance =
          collateralTokenSymbol === "SOL"
            ? Math.max(collateralBalance - FEE_BUFFER, 0)
            : collateralBalance

        if (effectiveCollateralBalance < collateralAmount) {
          if (shouldLogScan(`${userWallet}:create-borrow`)) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "scan",
              details: `Create borrow: insufficient ${collateralTokenSymbol} collateral (${effectiveCollateralBalance.toFixed(4)} < ${collateralAmount.toFixed(4)})`,
              txHash: null,
              status: "success",
            })
          }
        } else if (collateralTokenSymbol !== "SOL" && solBalance < FEE_BUFFER) {
          if (shouldLogScan(`${userWallet}:create-borrow`)) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "scan",
              details: `Create borrow: insufficient SOL for fees (${solBalance.toFixed(4)})`,
              txHash: null,
              status: "success",
            })
          }
        } else {
          try {
            // Post Pyth price updates for on-chain collateral ratio validation
            const botKeypair = Keypair.fromSecretKey(
              Uint8Array.from(JSON.parse(process.env.FORECLOSURE_BOT_KEYPAIR || "[]"))
            )
            const collateralFeedId = PYTH_FEED_IDS[collateralTokenSymbol]
            const debtFeedId = PYTH_FEED_IDS[debtTokenSymbol]
            if (!collateralFeedId || !debtFeedId) throw new Error(`No Pyth feed for ${collateralTokenSymbol}/${debtTokenSymbol}`)
            const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
              connection, botKeypair, [...new Set([collateralFeedId, debtFeedId])]
            )

            let txHash: string
            let stealthPubkey: string | undefined
            try {
              if (config.privacyEnabled) {
                const result = await createPrivateBorrowRequestAsAgent({
                  ownerWallet: userWallet,
                  agentWallet: agentPubkeyStr,
                  debtTokenSymbol,
                  collateralTokenSymbol,
                  debtAmount,
                  collateralAmount,
                  duration,
                  apy,
                  priceUpdates: {
                    collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                    debtPriceUpdate: priceUpdateAccounts[debtFeedId],
                  },
                })
                txHash = result.txHash
                stealthPubkey = result.stealthPublicKey
              } else {
                const serializedTx = await buildCreateBorrowRequestTx(
                  connection,
                  program,
                  agentPubkey,
                  { debtTokenSymbol, collateralTokenSymbol, debtAmount, collateralAmount, duration, apy },
                  {
                    collateralPriceUpdate: priceUpdateAccounts[collateralFeedId],
                    debtPriceUpdate: priceUpdateAccounts[debtFeedId],
                  },
                )
                txHash = await signAndSendTransaction(userWallet, serializedTx)
              }
            } finally {
              cleanup().catch(() => {})
            }
            balanceCache.delete(collateralTokenSymbol)

            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "created_borrow_request",
              details:
                `Created ${config.privacyEnabled ? "private " : ""}borrow request: ` +
                `${debtAmount.toFixed(2)} ${debtTokenSymbol} at ${apy}% APY, ${duration}s, ` +
                `collateral ${collateralAmount.toFixed(4)} ${collateralTokenSymbol}` +
                (stealthPubkey ? ` (stealth ${stealthPubkey.slice(0, 8)}...)` : ""),
              txHash,
              status: "success",
            })

            // Notify followers of new request (fire-and-forget)
            notifyNetworkLoanCreated(userWallet, {
              debtToken: debtTokenSymbol, amount: debtAmount,
              apy, loanType: "borrow request",
            }).catch(() => {})
          } catch (err) {
            await logAction(userWallet, {
              timestamp: new Date().toISOString(),
              type: "error",
              details: `Failed to create borrow request: ${errMsg(err)}`,
              txHash: null,
              status: "error",
            })
          }
        }
      }
    } catch (err) {
      await logAction(userWallet, {
        timestamp: new Date().toISOString(),
        type: "error",
        details: `Create borrow request error: ${errMsg(err)}`,
        txHash: null,
        status: "error",
      })
    }
  }
}
