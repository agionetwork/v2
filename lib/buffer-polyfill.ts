/**
 * Top-level Buffer polyfill — must be the FIRST import in app/layout.tsx so
 * it runs before any module that captures `globalThis.Buffer` at init time
 * (notably @solana/web3.js, which exposes account data as Buffer instances
 * later consumed by @cloak.dev/sdk's `readBigUInt64LE`/`readBigInt64LE`).
 *
 * Without this, the production browser bundle ships a Buffer missing BigInt
 * methods and the relay errors with
 *   "t.Buffer.from(...).readBigInt64LE is not a function".
 *
 * Side-effect import. No exports.
 */

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer: PolyBuffer } = require("buffer") as { Buffer: typeof globalThis.Buffer }

  // Always replace globalThis.Buffer with the full buffer@6.x implementation —
  // some bundles ship a stripped-down version. Idempotent: re-running with the
  // already-patched Buffer is a no-op.
  ;(globalThis as any).Buffer = PolyBuffer

  const proto = (PolyBuffer.prototype as unknown) as Record<string, unknown>

  if (typeof proto.readBigInt64LE !== "function") {
    proto.readBigInt64LE = function readBigInt64LE(this: Uint8Array, offset = 0): bigint {
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
      return (BigInt(hi) << BigInt(32)) | (BigInt(lo) & BigInt(0xffffffff))
    }
  }

  if (typeof proto.readBigUInt64LE !== "function") {
    proto.readBigUInt64LE = function readBigUInt64LE(this: Uint8Array, offset = 0): bigint {
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

  if (typeof proto.writeBigInt64LE !== "function") {
    proto.writeBigInt64LE = function writeBigInt64LE(this: Uint8Array, value: bigint, offset = 0): number {
      const mask = BigInt("0xffffffff")
      const lo = Number(value & mask)
      const hi = Number((value >> BigInt(32)) & mask)
      this[offset] = lo & 0xff
      this[offset + 1] = (lo >> 8) & 0xff
      this[offset + 2] = (lo >> 16) & 0xff
      this[offset + 3] = (lo >> 24) & 0xff
      this[offset + 4] = hi & 0xff
      this[offset + 5] = (hi >> 8) & 0xff
      this[offset + 6] = (hi >> 16) & 0xff
      this[offset + 7] = (hi >> 24) & 0xff
      return offset + 8
    }
  }

  if (typeof proto.writeBigUInt64LE !== "function") {
    proto.writeBigUInt64LE = proto.readBigInt64LE === proto.readBigUInt64LE
      ? proto.writeBigInt64LE
      : function writeBigUInt64LE(this: Uint8Array, value: bigint, offset = 0): number {
          const mask = BigInt("0xffffffff")
          const lo = Number(value & mask)
          const hi = Number((value >> BigInt(32)) & mask)
          this[offset] = lo & 0xff
          this[offset + 1] = (lo >> 8) & 0xff
          this[offset + 2] = (lo >> 16) & 0xff
          this[offset + 3] = (lo >> 24) & 0xff
          this[offset + 4] = hi & 0xff
          this[offset + 5] = (hi >> 8) & 0xff
          this[offset + 6] = (hi >> 16) & 0xff
          this[offset + 7] = (hi >> 24) & 0xff
          return offset + 8
        }
  }
}
