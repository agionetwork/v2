/**
 * Lightweight Pyth price update poster for Solana.
 *
 * Builds `post_update_atomic` instructions WITHOUT importing the heavy
 * @pythnetwork/pyth-solana-receiver SDK or using Anchor's Program class
 * (which causes cross-package PublicKey _bn errors).
 *
 * Instead, builds raw TransactionInstructions with manual Borsh serialization
 * and SHA-256 discriminators — zero Anchor dependency for Pyth receiver.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js"
import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
} from "@pythnetwork/price-service-sdk"
import { createHash } from "crypto"

// Hardcode program IDs to avoid cross-package PublicKey incompatibility
const RECEIVER_PROGRAM_ID = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ")
const WORMHOLE_PROGRAM_ID = new PublicKey("HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ")

// Anchor instruction discriminators: SHA-256("global:<method_name>") first 8 bytes
const POST_UPDATE_ATOMIC_DISCRIMINATOR = createHash("sha256")
  .update("global:post_update_atomic")
  .digest()
  .subarray(0, 8)

const RECLAIM_RENT_DISCRIMINATOR = createHash("sha256")
  .update("global:reclaim_rent")
  .digest()
  .subarray(0, 8)

// PDA derivation functions
function getGuardianSetPda(guardianSetIndex: number, wormholeProgramId: PublicKey): PublicKey {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(guardianSetIndex, 0)
  return PublicKey.findProgramAddressSync([Buffer.from("GuardianSet"), buf], wormholeProgramId)[0]
}

function getConfigPda(receiverProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], receiverProgramId)[0]
}

function getTreasuryPda(treasuryId: number, receiverProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury"), Buffer.from([treasuryId])], receiverProgramId)[0]
}

const HERMES_BASE_URL = "https://hermes.pyth.network"

/**
 * Maximum guardian signatures to keep in the VAA.
 * Each signature is 66 bytes. With 13 sigs (full quorum for 19 guardians),
 * the VAA alone is ~952 bytes — exceeding Solana's 1232-byte tx limit.
 * Trimming to 4 sigs reduces VAA to ~358 bytes, fitting in a single tx.
 * The Pyth receiver accepts partial verification (VerificationLevel::Partial).
 */
const MAX_VAA_SIGNATURES = 4

/** Extract guardian set index from raw VAA bytes (u32 BE at offset 1) */
function getGuardianSetIndex(vaa: Buffer): number {
  return vaa.readUInt32BE(1)
}

/**
 * Trim a Wormhole VAA to keep at most `maxSigs` guardian signatures.
 * This produces a smaller VAA that fits in a single Solana transaction.
 * The Pyth receiver will mark it as VerificationLevel::Partial.
 *
 * VAA format:
 *   [0]     version (1 byte)
 *   [1..5]  guardian_set_index (u32 BE)
 *   [5]     num_signatures (1 byte)
 *   [6..]   signatures (num_signatures × 66 bytes each)
 *           body (remaining bytes)
 */
function trimVaaSignatures(vaa: Buffer, maxSigs: number): Buffer {
  const numSigs = vaa[5]
  if (numSigs <= maxSigs) return vaa // already small enough

  const sigSize = 66 // 1 byte guardian_index + 32 bytes r + 32 bytes s + 1 byte v
  const headerSize = 6 // version(1) + guardian_set_index(4) + num_signatures(1)
  const bodyStart = headerSize + numSigs * sigSize
  const body = vaa.subarray(bodyStart)

  const trimmed = Buffer.alloc(headerSize + maxSigs * sigSize + body.length)
  // Copy header
  vaa.copy(trimmed, 0, 0, headerSize)
  // Update num_signatures
  trimmed[5] = maxSigs
  // Copy first maxSigs signatures
  vaa.copy(trimmed, headerSize, headerSize, headerSize + maxSigs * sigSize)
  // Copy body
  body.copy(trimmed, headerSize + maxSigs * sigSize)

  return trimmed
}

/**
 * Borsh-serialize the PostUpdateAtomicParams struct:
 *   { vaa: bytes, merklePriceUpdate: { message: bytes, proof: Vec<[u8;20]> }, treasuryId: u8 }
 *
 * Borsh layout:
 *   vaa:       u32 length + raw bytes
 *   message:   u32 length + raw bytes
 *   proof:     u32 count  + (count × 20 bytes, each fixed-size [u8;20])
 *   treasuryId: u8
 */
function serializePostUpdateAtomicParams(
  vaa: Buffer,
  message: Buffer,
  proof: Uint8Array[],
  treasuryId: number,
): Buffer {
  // Calculate total size
  const vaaLen = 4 + vaa.length
  const msgLen = 4 + message.length
  const proofLen = 4 + proof.length * 20
  const totalSize = vaaLen + msgLen + proofLen + 1 // +1 for treasuryId u8

  const buf = Buffer.alloc(totalSize)
  let offset = 0

  // vaa: bytes (Borsh Vec<u8> = u32 LE length + data)
  buf.writeUInt32LE(vaa.length, offset)
  offset += 4
  vaa.copy(buf, offset)
  offset += vaa.length

  // merklePriceUpdate.message: bytes
  buf.writeUInt32LE(message.length, offset)
  offset += 4
  message.copy(buf, offset)
  offset += message.length

  // merklePriceUpdate.proof: Vec<[u8; 20]> (u32 LE count + fixed arrays)
  buf.writeUInt32LE(proof.length, offset)
  offset += 4
  for (const p of proof) {
    Buffer.from(p).copy(buf, offset, 0, 20)
    offset += 20
  }

  // treasuryId: u8
  buf.writeUInt8(treasuryId, offset)

  return buf
}

/**
 * Build a raw `post_update_atomic` TransactionInstruction.
 */
function buildPostUpdateAtomicIx(
  payer: PublicKey,
  guardianSet: PublicKey,
  config: PublicKey,
  treasury: PublicKey,
  priceUpdateAccount: PublicKey,
  writeAuthority: PublicKey,
  vaa: Buffer,
  message: Buffer,
  proof: Uint8Array[],
  treasuryId: number,
): TransactionInstruction {
  const data = Buffer.concat([
    POST_UPDATE_ATOMIC_DISCRIMINATOR,
    serializePostUpdateAtomicParams(vaa, message, proof, treasuryId),
  ])

  return new TransactionInstruction({
    programId: RECEIVER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: guardianSet, isSigner: false, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: priceUpdateAccount, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: writeAuthority, isSigner: true, isWritable: false },
    ],
    data,
  })
}

/**
 * Build a raw `reclaim_rent` TransactionInstruction.
 */
function buildReclaimRentIx(
  payer: PublicKey,
  priceUpdateAccount: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: RECEIVER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: priceUpdateAccount, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(RECLAIM_RENT_DISCRIMINATOR),
  })
}

export interface PricePostResult {
  /** Instructions to post price updates on-chain */
  postInstructions: TransactionInstruction[]
  /** Ephemeral signers for the price update accounts */
  ephemeralSigners: Keypair[]
  /** Map of feed ID (hex, no 0x) → price update account address */
  priceUpdateAccounts: Record<string, PublicKey>
  /** Instructions to close the price update accounts (recover rent) */
  closeInstructions: TransactionInstruction[]
}

/**
 * Fetch binary price update data from Pyth Hermes API.
 * @param feedIds - Pyth feed IDs (hex, no 0x prefix)
 */
export async function fetchHermesUpdates(feedIds: string[]): Promise<string[]> {
  const idsParam = feedIds.map((id) => `ids[]=0x${id}`).join("&")
  const url = `${HERMES_BASE_URL}/v2/updates/price/latest?${idsParam}&encoding=base64`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Hermes API ${res.status}`)
  const data = await res.json()
  return data.binary?.data || []
}

/**
 * Build post_update_atomic instructions for each price update in the binary data.
 * Creates ephemeral PriceUpdateV2 accounts that can be consumed by your program.
 *
 * Uses raw instruction construction (no Anchor Program class) to avoid
 * cross-package PublicKey incompatibility with the Pyth receiver IDL.
 */
export async function buildPostPriceUpdateInstructions(
  connection: Connection,
  payer: Keypair,
  priceUpdateData: string[],
): Promise<PricePostResult> {
  const postInstructions: TransactionInstruction[] = []
  const closeInstructions: TransactionInstruction[] = []
  const ephemeralSigners: Keypair[] = []
  const priceUpdateAccounts: Record<string, PublicKey> = {}

  for (const b64Data of priceUpdateData) {
    const buf = Buffer.from(b64Data, "base64")
    const parsed = parseAccumulatorUpdateData(buf)

    // Derive guardian set PDA from VAA
    const guardianSetIndex = getGuardianSetIndex(Buffer.from(parsed.vaa))
    const guardianSetPda = getGuardianSetPda(guardianSetIndex, WORMHOLE_PROGRAM_ID)

    // Config + treasury PDAs
    const configPda = getConfigPda(RECEIVER_PROGRAM_ID)
    const treasuryId = Math.floor(Math.random() * 256)
    const treasuryPda = getTreasuryPda(treasuryId, RECEIVER_PROGRAM_ID)

    // Process each price update in the accumulator data
    for (const update of parsed.updates) {
      // Create ephemeral keypair for the PriceUpdateV2 account
      const priceUpdateKeypair = Keypair.generate()
      ephemeralSigners.push(priceUpdateKeypair)

      // Parse the feed ID from the message to map account addresses
      const priceFeedMessage = parsePriceFeedMessage(Buffer.from(update.message))
      const feedIdHex = Buffer.from(priceFeedMessage.feedId).toString("hex")
      priceUpdateAccounts[feedIdHex] = priceUpdateKeypair.publicKey

      // Convert proof arrays to Uint8Array[]
      const proofArrays = update.proof.map((p: number[] | Uint8Array) =>
        p instanceof Uint8Array ? p : Uint8Array.from(p)
      )

      // Trim VAA signatures to fit in a single Solana transaction.
      // Full VAA with 13 guardian sigs is ~952 bytes — over the 1232-byte tx limit.
      const trimmedVaa = trimVaaSignatures(Buffer.from(parsed.vaa), MAX_VAA_SIGNATURES)

      // Build post_update_atomic instruction (raw, no Anchor Program)
      const postIx = buildPostUpdateAtomicIx(
        payer.publicKey,
        guardianSetPda,
        configPda,
        treasuryPda,
        priceUpdateKeypair.publicKey,
        payer.publicKey, // writeAuthority = payer
        trimmedVaa,
        Buffer.from(update.message),
        proofArrays,
        treasuryId,
      )
      postInstructions.push(postIx)

      // Build close instruction to recover rent after consumption
      const closeIx = buildReclaimRentIx(payer.publicKey, priceUpdateKeypair.publicKey)
      closeInstructions.push(closeIx)
    }
  }

  return {
    postInstructions,
    ephemeralSigners,
    priceUpdateAccounts,
    closeInstructions,
  }
}

/**
 * High-level helper: post Pyth price updates for the given token symbols.
 * Posts each price update in its own transaction (trimmed VAA fits one tx).
 *
 * Returns the on-chain PriceUpdateV2 account addresses and a cleanup()
 * function that closes them to recover rent.
 */
export async function postPriceUpdatesForMints(
  connection: Connection,
  payerKeypair: Keypair,
  feedIds: string[],
): Promise<{
  priceUpdateAccounts: Record<string, PublicKey>
  cleanup: () => Promise<void>
}> {
  // Fetch binary price data from Hermes
  const priceUpdateData = await fetchHermesUpdates(feedIds)
  if (!priceUpdateData.length) {
    throw new Error("Empty Hermes response — no price updates available")
  }

  // Build post_update_atomic instructions
  const pythResult = await buildPostPriceUpdateInstructions(
    connection,
    payerKeypair,
    priceUpdateData,
  )

  const computeBudgetIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  ]

  // Send each price update in its own transaction
  for (let i = 0; i < pythResult.postInstructions.length; i++) {
    const tx = new Transaction()
    tx.add(...computeBudgetIxs)
    tx.add(pythResult.postInstructions[i])
    const { blockhash } = await connection.getLatestBlockhash("confirmed")
    tx.recentBlockhash = blockhash
    tx.feePayer = payerKeypair.publicKey
    tx.sign(payerKeypair, pythResult.ephemeralSigners[i])
    const sig = await connection.sendRawTransaction(tx.serialize())
    await connection.confirmTransaction(sig, "confirmed")
  }

  // Cleanup function: close PriceUpdateV2 accounts to reclaim rent
  const cleanup = async () => {
    try {
      for (const closeIx of pythResult.closeInstructions) {
        const tx = new Transaction()
        tx.add(closeIx)
        const { blockhash } = await connection.getLatestBlockhash("confirmed")
        tx.recentBlockhash = blockhash
        tx.feePayer = payerKeypair.publicKey
        tx.sign(payerKeypair)
        const sig = await connection.sendRawTransaction(tx.serialize())
        await connection.confirmTransaction(sig, "confirmed")
      }
    } catch {
      // Non-critical: rent reclaim failure doesn't affect loan creation
    }
  }

  return { priceUpdateAccounts: pythResult.priceUpdateAccounts, cleanup }
}
