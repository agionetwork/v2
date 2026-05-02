/**
 * Thin wrapper around `@cloak.dev/sdk`.
 *
 * The SDK is loaded lazily so the rest of the codebase imports from
 * `@/lib/cloak` and never directly from the SDK. The high-level helpers
 * exposed here are tailored to Agio's flow: shield → private transfer →
 * unshield, plus the swap path used during foreclosure liquidation.
 */

import type { Connection, Keypair, PublicKey } from "@solana/web3.js"
import type {
  PrivateTransferOptions,
  ShieldOptions,
  UnshieldOptions,
  ViewingKey,
} from "./types"

let sdkPromise: Promise<typeof import("@cloak.dev/sdk")> | null = null

/**
 * Cloak ships separate npm packages per network. The mainnet `@cloak.dev/sdk`
 * is pinned to `CLOAK_PROGRAM_ID = zh1eL...` + relay `api.cloak.ag`.
 * The devnet `@cloak.dev/sdk-devnet` is pinned to `Zc1k...` + `api.devnet.cloak.ag`
 * and bundles a mock-USDC mint. We pick at runtime based on the configured RPC.
 *
 * Override at build time via `NEXT_PUBLIC_CLOAK_NETWORK = "devnet" | "mainnet"`.
 * Default: `"devnet"` if `NEXT_PUBLIC_SOLANA_RPC_URL` looks like devnet, else mainnet.
 */
function resolveCloakNetwork(): "devnet" | "mainnet" {
  const explicit = process.env.NEXT_PUBLIC_CLOAK_NETWORK
  if (explicit === "devnet" || explicit === "mainnet") return explicit
  const rpc = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "").toLowerCase()
  if (rpc.includes("devnet")) return "devnet"
  if (rpc.includes("testnet")) return "devnet"
  if (rpc.includes("localhost") || rpc.includes("127.0.0.1")) return "devnet"
  return "mainnet"
}

/**
 * In the browser the SDK calls `Buffer.from(...).readBigInt64LE(0)` while
 * building deposit transactions. next.config.mjs disables the auto Buffer
 * polyfill (`buffer: false` in resolve.fallback), so the global Buffer
 * (typically provided by other wallet libs) may be missing
 * `readBigInt64LE`. The error surfaces as
 *   "Relay returned an error: publicAmountBuffer.readBigInt64LE is not a function"
 * Force the proper polyfill from the `buffer` npm package on globalThis the
 * first time we touch the SDK in the browser.
 */
async function ensureBufferPolyfill() {
  if (typeof window === "undefined") return
  const g = globalThis as any
  const probe = g.Buffer?.from?.("")
  const ok = probe && typeof probe.readBigInt64LE === "function"
  if (ok) {
    console.log("[cloak] Buffer polyfill OK (readBigInt64LE present)")
    return
  }
  console.warn(
    "[cloak] Buffer polyfill missing readBigInt64LE — replacing globalThis.Buffer with buffer@6.x",
  )
  const mod: any = await import("buffer")
  console.log("[cloak] imported buffer module:", {
    keys: Object.keys(mod || {}),
    bufferType: typeof mod?.Buffer,
    hasFrom: typeof mod?.Buffer?.from,
    sample: mod?.Buffer?.from?.("test"),
    sampleProto: mod?.Buffer?.from?.("test") &&
      Object.getOwnPropertyNames(Object.getPrototypeOf(mod.Buffer.from("test"))),
  })
  const PolyBuffer = mod.Buffer
  if (!PolyBuffer || typeof PolyBuffer.from !== "function") {
    throw new Error(
      "import('buffer') did not return a usable Buffer constructor. " +
        "Module shape: " + JSON.stringify(Object.keys(mod || {})),
    )
  }
  g.Buffer = PolyBuffer
  // If the bundler stripped the BigInt methods, monkey-patch them onto the
  // prototype using the official feross/buffer implementation.
  const proto = PolyBuffer.prototype
  if (typeof proto.readBigInt64LE !== "function") {
    console.warn("[cloak] PolyBuffer.prototype lacks readBigInt64LE — monkey-patching")
    proto.readBigInt64LE = function readBigInt64LE(offset = 0) {
      const lo =
        (this[offset] | 0) |
        ((this[offset + 1] | 0) << 8) |
        ((this[offset + 2] | 0) << 16) |
        ((this[offset + 3] | 0) << 24)
      const hi =
        ((this[offset + 4] | 0) >>> 0) +
        ((this[offset + 5] | 0) << 8) +
        ((this[offset + 6] | 0) << 16) +
        ((this[offset + 7] | 0) << 24)
      // hi is signed 32-bit; combine with low (unsigned 32-bit).
      return (BigInt(hi) << BigInt(32)) | (BigInt(lo) & BigInt(0xffffffff))
    }
    proto.readBigUInt64LE = function readBigUInt64LE(offset = 0) {
      const lo =
        (this[offset] | 0) |
        ((this[offset + 1] | 0) << 8) |
        ((this[offset + 2] | 0) << 16) |
        ((this[offset + 3] | 0) << 24)
      const hi =
        (this[offset + 4] | 0) +
        ((this[offset + 5] | 0) << 8) +
        ((this[offset + 6] | 0) << 16) +
        ((this[offset + 7] | 0) << 24)
      return (BigInt(hi >>> 0) << BigInt(32)) | (BigInt(lo) & BigInt(0xffffffff))
    }
  }
  // Verify the swap worked.
  const probe2 = (globalThis as any).Buffer?.from?.("")
  if (!probe2 || typeof probe2.readBigInt64LE !== "function") {
    throw new Error(
      "Buffer polyfill failed even after monkey-patch: globalThis.Buffer.prototype.readBigInt64LE missing.",
    )
  }
  console.log("[cloak] Buffer polyfill installed (readBigInt64LE present)")
}

async function loadSdk() {
  if (!sdkPromise) {
    const network = resolveCloakNetwork()
    sdkPromise = ensureBufferPolyfill()
      .then(async () => {
        return network === "devnet"
          ? ((await import("@cloak.dev/sdk-devnet")) as unknown as typeof import("@cloak.dev/sdk"))
          : await import("@cloak.dev/sdk")
      })
      .then((sdk) => {
        // Browser-side: route circuit fetches through our proxy. The S3 bucket
        // hosting Cloak's circuits has no CORS, so direct browser fetches fail
        // with `NetworkError`. The proxy at /api/cloak-proxy/circuits forwards
        // to S3 server-side. No-op when running on the server (same fetch the
        // proxy would do).
        if (typeof window !== "undefined" && typeof sdk.setCircuitsPath === "function") {
          sdk.setCircuitsPath("/api/cloak-proxy/circuits")
        }
        return sdk
      })
      .catch((err) => {
        throw new Error(
          `Cloak SDK failed to load (${network}). Make sure the right package ` +
            `is installed (\`pnpm add @cloak.dev/${network === "devnet" ? "sdk-devnet" : "sdk"}\`). ` +
            `Original error: ${err?.message ?? err}`,
        )
      }) as Promise<typeof import("@cloak.dev/sdk")>
  }
  return sdkPromise
}

/**
 * Default relay URL the wrapper passes to SDK calls. In browsers we route
 * through `/api/cloak-proxy/relay` (same origin, no CORS hassle). On the
 * server we hit the upstream relay directly.
 */
function defaultRelayUrl(network: "devnet" | "mainnet"): string {
  if (typeof window !== "undefined") return "/api/cloak-proxy/relay"
  return network === "devnet" ? "https://api.devnet.cloak.ag" : "https://api.cloak.ag"
}

/**
 * Build the SDK signing block for `transact`/`transfer`/`fullWithdraw` etc.
 *
 * The standalone helpers in @cloak.dev/sdk* accept either:
 *   - `depositorKeypair: Keypair`     (Node / server-side flows)
 *   - `signTransaction` + `depositorPublicKey` (browser wallet adapter)
 *
 * We pass through `walletPublicKey` separately because the SDK uses it for
 * relay submissions when no depositor keypair is provided. Note: passing the
 * raw wallet adapter via a `wallet` field is NOT a valid TransactOptions
 * shape (that's only for the `CloakSDK` class constructor); the SDK throws
 * "Deposits require depositorKeypair or signTransaction + depositorPublicKey"
 * if we omit them.
 */
function buildSigningBlock(signing: CloakSignerContext) {
  if (signing.depositorKeypair) {
    return {
      depositorKeypair: signing.depositorKeypair,
      walletPublicKey: signing.walletPublicKey,
      depositorPublicKey: signing.walletPublicKey,
    }
  }
  const w = signing.wallet
  if (!w?.signTransaction) {
    throw new Error(
      "Cloak signing requires either a Keypair (depositorKeypair) or a wallet adapter " +
        "with `signTransaction`. Got: " + (w ? "wallet without signTransaction" : "no wallet"),
    )
  }
  return {
    signTransaction: w.signTransaction.bind(w),
    signMessage: typeof w.signMessage === "function" ? w.signMessage.bind(w) : undefined,
    depositorPublicKey: signing.walletPublicKey,
    walletPublicKey: signing.walletPublicKey,
  }
}

export interface CloakSignerContext {
  /** Public key the SDK should attribute fees to. */
  walletPublicKey: PublicKey
  /** Required for keypair-mode signing (Node, server-side agent flows). */
  depositorKeypair?: Keypair
  /** Wallet adapter for browser flows. Mutually exclusive with `depositorKeypair`. */
  wallet?: any
}

export interface BaseTransactOptions extends CloakSignerContext {
  connection: Connection
  /** Override the default program id (`CLOAK_PROGRAM_ID`). Rare. */
  programId?: PublicKey
  /** Override the default relay URL. Rare. */
  relayUrl?: string
  /** Disable viewing-key registration for one-shot flows that don't audit. */
  enforceViewingKeyRegistration?: boolean
  /** Status updates (relay calls, signing). */
  onProgress?: (status: string) => void
  /** ZK proof generation progress 0-100. */
  onProofProgress?: (percent: number) => void
}

// ---------------------------------------------------------------------------
// Shield: take public token balance and create a shielded UTXO the recipient
// can later spend privately.
// ---------------------------------------------------------------------------

export async function shield(
  opts: ShieldOptions,
  signing: BaseTransactOptions,
): Promise<{ utxo: any; signature: string; commitmentIndex: number }> {
  await ensureBufferPolyfill()
  const sdk = await loadSdk()
  const programId = signing.programId ?? sdk.CLOAK_PROGRAM_ID
  const recipient = await resolveUtxoOwner(sdk, opts.recipient)
  const output = await sdk.createUtxo(opts.amount, recipient, opts.mint)
  const result = await sdk.transact(
    {
      inputUtxos: [
        await sdk.createZeroUtxo(opts.mint),
        await sdk.createZeroUtxo(opts.mint),
      ],
      outputUtxos: [output, await sdk.createZeroUtxo(opts.mint)],
      externalAmount: opts.amount,
      depositor: signing.walletPublicKey,
    },
    {
      connection: signing.connection,
      programId,
      relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
      ...buildSigningBlock(signing),
      enforceViewingKeyRegistration: signing.enforceViewingKeyRegistration ?? false,
      onProgress: signing.onProgress,
      onProofProgress: signing.onProofProgress,
    } as any,
  )
  return {
    utxo: result.outputUtxos[0],
    signature: (result as any).signature,
    commitmentIndex: (result as any).commitmentIndices?.[0] ?? -1,
  }
}

// ---------------------------------------------------------------------------
// Private transfer: shield-to-shield. Takes input UTXOs the caller already
// owns and produces an output UTXO owned by `toUtxoPubkey`.
// ---------------------------------------------------------------------------

export async function privateTransfer(
  inputUtxos: any[],
  toUtxoPubkey: bigint,
  amount: bigint,
  signing: BaseTransactOptions,
  _opts?: Pick<PrivateTransferOptions, "memo">,
): Promise<{ outputUtxos: any[]; signature: string }> {
  await ensureBufferPolyfill()
  const sdk = await loadSdk()
  const programId = signing.programId ?? sdk.CLOAK_PROGRAM_ID
  const result = await (sdk as any).transfer(inputUtxos, toUtxoPubkey, amount, {
    connection: signing.connection,
    programId,
    relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
    ...buildSigningBlock(signing),
    enforceViewingKeyRegistration: signing.enforceViewingKeyRegistration ?? false,
      onProgress: signing.onProgress,
      onProofProgress: signing.onProofProgress,
  })
  return { outputUtxos: result.outputUtxos, signature: result.signature }
}

// ---------------------------------------------------------------------------
// Unshield (full or partial): release shielded balance back to a public
// address. Use `partialWithdraw` to keep change shielded.
// ---------------------------------------------------------------------------

export async function unshield(
  opts: UnshieldOptions & { inputUtxos: any[]; partialAmount?: bigint },
  signing: BaseTransactOptions,
): Promise<{ signature: string; changeUtxos?: any[] }> {
  await ensureBufferPolyfill()
  const sdk = await loadSdk()
  const programId = signing.programId ?? sdk.CLOAK_PROGRAM_ID
  if (opts.partialAmount && opts.partialAmount < opts.amount) {
    const result = await sdk.partialWithdraw(
      opts.inputUtxos,
      opts.toAddress,
      opts.partialAmount,
      {
        connection: signing.connection,
        programId,
        relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
        ...buildSigningBlock(signing),
        enforceViewingKeyRegistration: signing.enforceViewingKeyRegistration ?? false,
      onProgress: signing.onProgress,
      onProofProgress: signing.onProofProgress,
      } as any,
    )
    return {
      signature: (result as any).signature,
      changeUtxos: (result as any).outputUtxos,
    }
  }
  const result = await sdk.fullWithdraw(opts.inputUtxos, opts.toAddress, {
    connection: signing.connection,
    programId,
    relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
    ...buildSigningBlock(signing),
    enforceViewingKeyRegistration: signing.enforceViewingKeyRegistration ?? false,
      onProgress: signing.onProgress,
      onProofProgress: signing.onProofProgress,
  } as any)
  return { signature: (result as any).signature }
}

// ---------------------------------------------------------------------------
// Swap (private SOL → SPL): used during foreclosure when collateral has to be
// liquidated without revealing the foreclosure event publicly.
// ---------------------------------------------------------------------------

export interface PrivateSwapOptions {
  inputUtxos: any[]
  swapAmount: bigint
  outputMint: PublicKey
  recipientAta: PublicKey
  minOutputAmount: bigint
}

export async function privateSwap(
  opts: PrivateSwapOptions,
  signing: BaseTransactOptions,
): Promise<{ signature: string; changeUtxos?: any[] }> {
  await ensureBufferPolyfill()
  const sdk = await loadSdk()
  const programId = signing.programId ?? sdk.CLOAK_PROGRAM_ID
  const result = await sdk.swapUtxo(
    {
      inputUtxos: opts.inputUtxos,
      swapAmount: opts.swapAmount,
      outputMint: opts.outputMint,
      recipientAta: opts.recipientAta,
      minOutputAmount: opts.minOutputAmount,
    },
    {
      connection: signing.connection,
      programId,
      relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
      ...buildSigningBlock(signing),
      enforceViewingKeyRegistration: signing.enforceViewingKeyRegistration ?? false,
      onProgress: signing.onProgress,
      onProofProgress: signing.onProofProgress,
    } as any,
  )
  return {
    signature: (result as any).signature,
    changeUtxos: (result as any).outputUtxos,
  }
}

// ---------------------------------------------------------------------------
// Viewing keys
// ---------------------------------------------------------------------------

export async function generateUtxoOwner(): Promise<{ privateKey: bigint; publicKey: bigint }> {
  const sdk = await loadSdk()
  return sdk.generateUtxoKeypair()
}

export async function generateViewingKey(scope: string, expiresAt?: number): Promise<ViewingKey> {
  const sdk = await loadSdk()
  const pair = sdk.generateViewingKeyPair()
  // The SDK returns raw bytes; we hex-encode for storage/transport.
  const hex = sdk.bytesToHex(pair.privateKey)
  return { key: hex, scope, expiresAt }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUtxoOwner(
  sdk: typeof import("@cloak.dev/sdk"),
  recipient?: string,
): Promise<{ privateKey: bigint; publicKey: bigint }> {
  // No recipient => mint a fresh keypair (caller must persist it to spend later).
  if (!recipient) return sdk.generateUtxoKeypair()
  // We accept either a hex-encoded private key or a JSON-encoded keypair.
  try {
    const parsed = JSON.parse(recipient) as { privateKey: string; publicKey: string }
    return {
      privateKey: BigInt(parsed.privateKey),
      publicKey: BigInt(parsed.publicKey),
    }
  } catch {
    return { privateKey: BigInt(recipient), publicKey: BigInt(0) }
  }
}
