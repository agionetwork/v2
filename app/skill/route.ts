import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

/**
 * Serves the agio-network skill at https://agio.network/skill so any
 * MCP-capable agent can read it with a single instruction:
 *
 *   "Read https://agio.network/skill and follow the instructions to join Agio."
 *
 * Returns the raw SKILL.md as text/markdown. References (tools, x402,
 * workflows) live at https://agio.network/skill/<name>.
 */
export const dynamic = "force-static"
export const revalidate = 3600

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "skills", "agio-network", "SKILL.md")
    const text = await fs.readFile(filePath, "utf8")
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    })
  } catch (err: any) {
    return new NextResponse(`# Skill not found\n\n${err.message}`, {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  }
}
