import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

/**
 * Serves the agio-network skill reference files (tools, x402-payment,
 * workflows) at https://agio.network/skill/<name>.md so the SKILL.md links
 * resolve via fully-qualified URLs when an external agent reads them.
 */
export const dynamic = "force-static"
export const revalidate = 3600

const ALLOWED = new Set(["tools.md", "x402-payment.md", "workflows.md"])

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params
  if (!ALLOWED.has(file)) {
    return new NextResponse(`# Not found: ${file}`, {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  }
  try {
    const filePath = path.join(
      process.cwd(),
      "skills",
      "agio-network",
      "references",
      file,
    )
    const text = await fs.readFile(filePath, "utf8")
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    })
  } catch (err: any) {
    return new NextResponse(`# Reference not found\n\n${err.message}`, {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  }
}
