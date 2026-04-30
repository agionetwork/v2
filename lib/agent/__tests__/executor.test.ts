import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock all external dependencies
vi.mock("@/lib/agent/redis", () => ({
  getAgentConfig: vi.fn(),
  getAgentPublicKey: vi.fn(),
  appendAgentAction: vi.fn(),
}))

vi.mock("@/lib/agent/privy", () => ({
  signAndSendTransaction: vi.fn(),
}))

vi.mock("@/lib/agent/jupiter", () => ({
  executeSwap: vi.fn(),
}))

vi.mock("@/lib/program", () => ({
  createConnection: vi.fn().mockReturnValue({
    getBalance: vi.fn().mockResolvedValue(10_000_000_000),
    getTokenAccountBalance: vi.fn().mockResolvedValue({ value: { uiAmount: 500 } }),
  }),
  createReadonlyProgram: vi.fn().mockReturnValue({}),
}))

vi.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddressSync: vi.fn().mockReturnValue("mockAta"),
}))

vi.mock("@/lib/token-mints", () => ({
  TOKEN_MINTS: { USDC: "USDCmint", EURC: "EURCmint", SOL: "So11111111111111111111111111111111111111112" },
  TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
}))

vi.mock("@/lib/token-prices", () => ({
  fetchTokenPrices: vi.fn().mockResolvedValue({ SOL: 80, USDC: 1, EURC: 1.08 }),
}))

vi.mock("@/lib/agent/loan-scanner", () => ({
  fetchAllLoans: vi.fn().mockResolvedValue([]),
  filterPendingBorrowRequests: vi.fn().mockReturnValue([]),
  filterPendingLendOffers: vi.fn().mockReturnValue([]),
  filterExpiredLoans: vi.fn().mockReturnValue([]),
  filterLoansToRepay: vi.fn().mockReturnValue([]),
  matchLoanToConfig: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/agent/transaction-builder", () => ({
  buildAcceptBorrowRequestTx: vi.fn().mockResolvedValue("serializedTx"),
  buildAcceptLendOfferTx: vi.fn().mockResolvedValue("serializedTx"),
  buildForecloseLoanTx: vi.fn().mockResolvedValue("serializedTx"),
  buildRepayLoanTx: vi.fn().mockResolvedValue("serializedTx"),
}))

import { getAgentConfig, getAgentPublicKey, appendAgentAction } from "@/lib/agent/redis"
import { signAndSendTransaction } from "@/lib/agent/privy"
import {
  fetchAllLoans,
  filterPendingBorrowRequests,
  filterExpiredLoans,
  filterLoansToRepay,
  matchLoanToConfig,
} from "@/lib/agent/loan-scanner"
import { executeAgentCycle } from "../executor"

const WALLET = "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs"
const AGENT_PUBKEY = "AgENTPubKeY111111111111111111111111111111111"

function makeLoan(overrides: Record<string, any> = {}) {
  return {
    publicKey: "loan1",
    version: 1,
    createKey: "createKey1",
    bump: 255,
    lender: null as string | null,
    borrower: null as string | null,
    debtMint: "USDCmint",
    collateralMint: "So11111111111111111111111111111111111111112",
    debtAmount: 100_000_000,
    collateralAmount: 2_000_000_000,
    debtAmountUi: 100,
    collateralAmountUi: 200,
    debtTokenSymbol: "USDC",
    collateralTokenSymbol: "SOL",
    start: null as number | null,
    duration: 30 * 86400,
    apy: 10,
    privateStatus: 0,
    status: 0,
    offerType: "borrow" as const,
    ...overrides,
  }
}

function makeConfig(overrides = {}) {
  return {
    enabled: true,
    createdAt: "2025-01-01",
    lendEnabled: false,
    lendTokens: ["USDC"],
    lendMinApy: 5,
    lendMinAmountUsd: 100,
    lendMaxAmountUsd: 5000,
    lendMaxDuration: 30,
    lendAcceptedCollateral: ["SOL"],
    lendMinCollateralRatio: 150,
    lendMaxCollateralRatio: 300,
    lendAutoForeclose: true,
    lendAutoCreateOffers: false,
    borrowEnabled: false,
    borrowTokens: ["USDC"],
    borrowMaxApy: 15,
    borrowMinAmountUsd: 50,
    borrowMaxAmountUsd: 2000,
    borrowCollateralTokens: ["SOL"],
    borrowMinCollateralRatio: 150,
    borrowMaxCollateralRatio: 200,
    borrowMaxDuration: 30,
    borrowAutoRepay: true,
    borrowAutoCreateRequests: false,
    swapEnabled: false,
    swapSlippageBps: 50,
    swapAutoRebalance: false,
    ...overrides,
  }
}

describe("executeAgentCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips when config is null", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(null)
    await executeAgentCycle(WALLET)
    expect(fetchAllLoans).not.toHaveBeenCalled()
  })

  it("skips when agent is disabled", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig({ enabled: false }))
    await executeAgentCycle(WALLET)
    expect(fetchAllLoans).not.toHaveBeenCalled()
  })

  it("skips when agentPublicKey is null", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig())
    vi.mocked(getAgentPublicKey).mockResolvedValue(null)
    await executeAgentCycle(WALLET)
    expect(fetchAllLoans).not.toHaveBeenCalled()
  })

  it("prevents concurrent cycles for same wallet", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig({ lendEnabled: true }))
    vi.mocked(getAgentPublicKey).mockResolvedValue(AGENT_PUBKEY)
    vi.mocked(fetchAllLoans).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
    )

    const p1 = executeAgentCycle(WALLET)
    const p2 = executeAgentCycle(WALLET)
    await Promise.all([p1, p2])

    // fetchAllLoans should only be called once due to concurrent lock
    expect(fetchAllLoans).toHaveBeenCalledTimes(1)
  })

  it("logs error and rethrows when fetchAllLoans fails", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig({ lendEnabled: true }))
    vi.mocked(getAgentPublicKey).mockResolvedValue(AGENT_PUBKEY)
    vi.mocked(fetchAllLoans).mockRejectedValue(new Error("RPC timeout"))

    await expect(executeAgentCycle(WALLET)).rejects.toThrow("RPC timeout")
    expect(appendAgentAction).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({
        type: "error",
        status: "error",
      }),
    )
  })

  it("accepts best borrow request when lending is enabled", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(
      makeConfig({ lendEnabled: true }),
    )
    vi.mocked(getAgentPublicKey).mockResolvedValue(AGENT_PUBKEY)
    vi.mocked(fetchAllLoans).mockResolvedValue([])
    vi.mocked(filterPendingBorrowRequests).mockReturnValue([
      makeLoan({ publicKey: "loan1", borrower: "SomeBorrower111", apy: 10 }),
      makeLoan({ publicKey: "loan2", borrower: "SomeBorrower222", debtAmountUi: 50, collateralAmountUi: 100, apy: 15 }),
    ] as any)
    vi.mocked(matchLoanToConfig).mockReturnValue(null) // no skip reason
    vi.mocked(signAndSendTransaction).mockResolvedValue("txhash123")

    await executeAgentCycle(WALLET)

    // Should have called signAndSendTransaction (accepted best offer)
    expect(signAndSendTransaction).toHaveBeenCalled()
    expect(appendAgentAction).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({
        type: "accepted_borrow_request",
        status: "success",
      }),
    )
  })

  it("forecloses expired loans when lendEnabled", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig({ lendEnabled: true }))
    vi.mocked(getAgentPublicKey).mockResolvedValue(AGENT_PUBKEY)
    vi.mocked(fetchAllLoans).mockResolvedValue([])
    vi.mocked(filterPendingBorrowRequests).mockReturnValue([])
    vi.mocked(filterExpiredLoans).mockReturnValue([
      makeLoan({
        publicKey: "expiredLoan1",
        borrower: "someBorrower",
        lender: AGENT_PUBKEY,
        duration: 86400,
        status: 1,
        offerType: "lend",
        start: Date.now() / 1000 - 86400 * 2,
      }),
    ] as any)
    vi.mocked(signAndSendTransaction).mockResolvedValue("foreclose_tx")

    await executeAgentCycle(WALLET)

    expect(signAndSendTransaction).toHaveBeenCalled()
    expect(appendAgentAction).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({
        type: "foreclosed_loan",
        status: "success",
      }),
    )
  })

  it("auto-repays loans near expiry when borrowEnabled", async () => {
    vi.mocked(getAgentConfig).mockResolvedValue(makeConfig({ borrowEnabled: true }))
    vi.mocked(getAgentPublicKey).mockResolvedValue(AGENT_PUBKEY)
    vi.mocked(fetchAllLoans).mockResolvedValue([])
    vi.mocked(filterLoansToRepay).mockReturnValue([
      makeLoan({
        publicKey: "repayLoan1",
        borrower: AGENT_PUBKEY,
        lender: "someLender",
        debtAmountUi: 50,
        apy: 8,
        duration: 86400,
        status: 1,
        start: Date.now() / 1000 - 86400 + 3600,
      }),
    ] as any)
    vi.mocked(signAndSendTransaction).mockResolvedValue("repay_tx")

    await executeAgentCycle(WALLET)

    expect(signAndSendTransaction).toHaveBeenCalled()
    expect(appendAgentAction).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({
        type: "repaid_loan",
        status: "success",
      }),
    )
  })
})
