/**
 * Client-side Pyth price update instruction builder.
 *
 * Builds `post_update_atomic` and `reclaim_rent` instructions for inclusion
 * in the user's transaction. The user pays the Pyth receiver fee and
 * ephemeral account rent (recovered via reclaim_rent).
 *
 * This replaces the server-side bot posting pattern for regular loan
 * operations, making the platform sustainable on mainnet.
 */
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js"

// Inline accumulator parsing — avoids @pythnetwork/price-service-sdk which
// uses Node.js Buffer methods (readUint8, readUint16BE) that break in the
// browser's Turbopack Buffer polyfill.

const ACCUMULATOR_MAGIC = "504e4155" // "PNAU"
const KECCAK160_HASH_SIZE = 20

interface AccumulatorUpdate {
  message: Uint8Array
  proof: number[][]
}

function readU8(buf: Uint8Array, offset: number): number {
  return buf[offset]
}

function readU16BE(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1]
}

function parseAccumulatorUpdateData(data: Uint8Array): { vaa: Uint8Array; updates: AccumulatorUpdate[] } {
  // Verify magic "PNAU"
  const hex = Array.from(data.subarray(0, 4)).map(b => b.toString(16).padStart(2, "0")).join("")
  if (hex !== ACCUMULATOR_MAGIC) throw new Error("Invalid accumulator message")

  let cursor = 6 // skip magic (4) + major (1) + minor (1)
  const trailingPayloadSize = readU8(data, cursor)
  cursor += 1 + trailingPayloadSize
  cursor += 1 // proof type

  const vaaSize = readU16BE(data, cursor)
  cursor += 2
  const vaa = data.subarray(cursor, cursor + vaaSize)
  cursor += vaaSize

  const numUpdates = readU8(data, cursor)
  cursor += 1
  const updates: AccumulatorUpdate[] = []

  for (let i = 0; i < numUpdates; i++) {
    const messageSize = readU16BE(data, cursor)
    cursor += 2
    const message = data.subarray(cursor, cursor + messageSize)
    cursor += messageSize

    const numProofs = readU8(data, cursor)
    cursor += 1
    const proof: number[][] = []
    for (let j = 0; j < numProofs; j++) {
      proof.push(Array.from(data.subarray(cursor, cursor + KECCAK160_HASH_SIZE)))
      cursor += KECCAK160_HASH_SIZE
    }
    updates.push({ message, proof })
  }

  return { vaa, updates }
}

/** Extract feed ID (bytes 1..33) from a price feed message */
function extractFeedId(message: Uint8Array): Uint8Array {
  return message.subarray(1, 33)
}

// Pyth Solana Receiver program IDs
const RECEIVER_PROGRAM_ID = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ")
const WORMHOLE_PROGRAM_ID = new PublicKey("HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ")

// Pre-computed Anchor instruction discriminators (SHA-256 first 8 bytes).
// Browser-safe: no `crypto.createHash` needed at runtime.
// sha256("global:post_update_atomic")[0..8] = 31ac54c0afb434ea
const POST_UPDATE_ATOMIC_DISCRIMINATOR = Buffer.from([49, 172, 84, 192, 175, 180, 52, 234])
// sha256("global:reclaim_rent")[0..8] = dac813c5e359c016
const RECLAIM_RENT_DISCRIMINATOR = Buffer.from([218, 200, 19, 197, 227, 89, 192, 22])

// PDA derivation
function getGuardianSetPda(guardianSetIndex: number): PublicKey {
  const buf = Buffer.alloc(4)
  buf.writeUInt32BE(guardianSetIndex, 0)
  return PublicKey.findProgramAddressSync([Buffer.from("GuardianSet"), buf], WORMHOLE_PROGRAM_ID)[0]
}

function getConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], RECEIVER_PROGRAM_ID)[0]
}

function getTreasuryPda(treasuryId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), Buffer.from([treasuryId])],
    RECEIVER_PROGRAM_ID,
  )[0]
}

/** Maximum guardian signatures to keep — trimming fits VAA in a single tx */
const MAX_VAA_SIGNATURES = 4

/** Extract guardian set index from raw VAA bytes (u32 BE at offset 1) */
function getGuardianSetIndex(vaa: Uint8Array): number {
  return (vaa[1] << 24 | vaa[2] << 16 | vaa[3] << 8 | vaa[4]) >>> 0
}

/**
 * Trim a Wormhole VAA to keep at most `maxSigs` guardian signatures.
 * Produces a smaller VAA that fits in a single Solana transaction.
 */
function trimVaaSignatures(vaa: Buffer, maxSigs: number): Buffer {
  const numSigs = vaa[5]
  if (numSigs <= maxSigs) return vaa

  const sigSize = 66
  const headerSize = 6
  const bodyStart = headerSize + numSigs * sigSize
  const body = vaa.subarray(bodyStart)

  const trimmed = Buffer.alloc(headerSize + maxSigs * sigSize + body.length)
  vaa.copy(trimmed, 0, 0, headerSize)
  trimmed[5] = maxSigs
  vaa.copy(trimmed, headerSize, headerSize, headerSize + maxSigs * sigSize)
  body.copy(trimmed, headerSize + maxSigs * sigSize)

  return trimmed
}

/**
 * Borsh-serialize PostUpdateAtomicParams:
 *   { vaa: bytes, merklePriceUpdate: { message: bytes, proof: Vec<[u8;20]> }, treasuryId: u8 }
 */
function serializePostUpdateAtomicParams(
  vaa: Buffer,
  message: Buffer,
  proof: Uint8Array[],
  treasuryId: number,
): Buffer {
  const totalSize = (4 + vaa.length) + (4 + message.length) + (4 + proof.length * 20) + 1
  const buf = Buffer.alloc(totalSize)
  let offset = 0

  buf.writeUInt32LE(vaa.length, offset); offset += 4
  vaa.copy(buf, offset); offset += vaa.length

  buf.writeUInt32LE(message.length, offset); offset += 4
  message.copy(buf, offset); offset += message.length

  buf.writeUInt32LE(proof.length, offset); offset += 4
  for (const p of proof) {
    Buffer.from(p).copy(buf, offset, 0, 20); offset += 20
  }

  buf.writeUInt8(treasuryId, offset)
  return buf
}

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

export interface ClientPriceUpdateResult {
  /** Instructions to post price updates (add as pre-instructions) */
  postIxs: TransactionInstruction[]
  /** Instructions to reclaim rent (add as post-instructions) */
  reclaimIxs: TransactionInstruction[]
  /** Ephemeral signers — must be added to transaction signing */
  ephemeralSigners: Keypair[]
  /** Map of feed ID (hex) → price update account address */
  priceUpdateAccounts: Record<string, PublicKey>
}

/**
 * Build client-side Pyth price update instructions from Hermes binary data.
 *
 * @param payer - The user's wallet (pays Pyth fee + ephemeral account rent)
 * @param priceUpdateData - Base64-encoded binary data from Hermes API
 * @returns Instructions and signers to include in the user's transaction
 */
export function buildClientPriceUpdateIxs(
  payer: PublicKey,
  priceUpdateData: string[],
): ClientPriceUpdateResult {
  const postIxs: TransactionInstruction[] = []
  const reclaimIxs: TransactionInstruction[] = []
  const ephemeralSigners: Keypair[] = []
  const priceUpdateAccounts: Record<string, PublicKey> = {}

  for (const b64Data of priceUpdateData) {
    const buf = Buffer.from(b64Data, "base64")
    const parsed = parseAccumulatorUpdateData(buf)

    const guardianSetIndex = getGuardianSetIndex(parsed.vaa)
    const guardianSetPda = getGuardianSetPda(guardianSetIndex)
    const configPda = getConfigPda()
    const treasuryId = Math.floor(Math.random() * 256)
    const treasuryPda = getTreasuryPda(treasuryId)

    for (const update of parsed.updates) {
      const priceUpdateKeypair = Keypair.generate()
      ephemeralSigners.push(priceUpdateKeypair)

      const feedId = extractFeedId(update.message)
      const feedIdHex = Buffer.from(feedId).toString("hex")
      priceUpdateAccounts[feedIdHex] = priceUpdateKeypair.publicKey

      const proofArrays = update.proof.map((p: number[] | Uint8Array) =>
        p instanceof Uint8Array ? p : Uint8Array.from(p),
      )

      const trimmedVaa = trimVaaSignatures(Buffer.from(parsed.vaa), MAX_VAA_SIGNATURES)

      postIxs.push(
        buildPostUpdateAtomicIx(
          payer,
          guardianSetPda,
          configPda,
          treasuryPda,
          priceUpdateKeypair.publicKey,
          payer, // writeAuthority = payer
          trimmedVaa,
          Buffer.from(update.message),
          proofArrays,
          treasuryId,
        ),
      )

      reclaimIxs.push(buildReclaimRentIx(payer, priceUpdateKeypair.publicKey))
    }
  }

  return { postIxs, reclaimIxs, ephemeralSigners, priceUpdateAccounts }
}
