/**
 * Top-level Buffer polyfill — must be the FIRST import in app/layout.tsx so
 * it runs before any module that captures `globalThis.Buffer` at init time.
 *
 * Even after we replace `globalThis.Buffer` with the full `buffer@6.x`
 * implementation, bundlers like Turbopack may inline a SEPARATE Buffer
 * constructor inside the Cloak SDK bundle that doesn't share PolyBuffer's
 * prototype. Since Buffer extends Uint8Array, patching Uint8Array.prototype
 * guarantees the method resolves via the chain on any Buffer instance,
 * regardless of which Buffer constructor created it.
 *
 * Side-effect import. No exports.
 */

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer: PolyBuffer } = require("buffer") as { Buffer: typeof globalThis.Buffer }

  // Replace globalThis.Buffer with the full buffer@6.x implementation.
  ;(globalThis as any).Buffer = PolyBuffer

  // Patch BOTH Buffer.prototype AND Uint8Array.prototype so any Buffer
  // instance (including ones from a SDK-bundled Buffer copy) finds the
  // BigInt methods via the prototype chain.
  const targets: Record<string, unknown>[] = [
    PolyBuffer.prototype as unknown as Record<string, unknown>,
    Uint8Array.prototype as unknown as Record<string, unknown>,
  ]

  function patchAll(name: string, fn: Function) {
    for (const proto of targets) {
      if (typeof proto[name] !== "function") {
        proto[name] = fn
      }
    }
  }

  patchAll("readBigInt64LE", function readBigInt64LE(this: Uint8Array, offset = 0): bigint {
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
  })

  patchAll("readBigUInt64LE", function readBigUInt64LE(this: Uint8Array, offset = 0): bigint {
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
  })

  patchAll("writeBigInt64LE", function writeBigInt64LE(
    this: Uint8Array,
    value: bigint,
    offset = 0,
  ): number {
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
  })

  patchAll("writeBigUInt64LE", function writeBigUInt64LE(
    this: Uint8Array,
    value: bigint,
    offset = 0,
  ): number {
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
  })
}
