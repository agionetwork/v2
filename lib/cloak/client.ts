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

async function loadSdk() {
  if (!sdkPromise) {
    const network = resolveCloakNetwork()
    sdkPromise = (
      network === "devnet"
        ? import("@cloak.dev/sdk-devnet")
        : import("@cloak.dev/sdk")
    )
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
      depositorKeypair: signing.depositorKeypair,
      wallet: signing.wallet,
      walletPublicKey: signing.walletPublicKey,
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
  const sdk = await loadSdk()
  const programId = signing.programId ?? sdk.CLOAK_PROGRAM_ID
  const result = await (sdk as any).transfer(inputUtxos, toUtxoPubkey, amount, {
    connection: signing.connection,
    programId,
    relayUrl: signing.relayUrl ?? defaultRelayUrl(resolveCloakNetwork()),
    depositorKeypair: signing.depositorKeypair,
    wallet: signing.wallet,
    walletPublicKey: signing.walletPublicKey,
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
        depositorKeypair: signing.depositorKeypair,
        wallet: signing.wallet,
        walletPublicKey: signing.walletPublicKey,
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
    depositorKeypair: signing.depositorKeypair,
    wallet: signing.wallet,
    walletPublicKey: signing.walletPublicKey,
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
      depositorKeypair: signing.depositorKeypair,
      wallet: signing.wallet,
      walletPublicKey: signing.walletPublicKey,
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
