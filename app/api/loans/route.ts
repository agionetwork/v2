import { NextResponse } from "next/server"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts } from "@/lib/loan-utils"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const connection = createConnection()
    const program = createReadonlyProgram(connection)
    const allAccounts = await (program.account as any).loan.all()
    const loans = parseLoanAccounts(allAccounts)
    return NextResponse.json(loans)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Failed to fetch loans:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
