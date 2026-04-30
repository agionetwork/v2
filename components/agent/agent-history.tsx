"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, History } from "lucide-react"
import { solscanClusterParam } from "@/config/solana"
import type { AgentAction } from "@/lib/agent/types"

interface Props {
  wallet: string
  authQuery: string
}

const ACTION_LABELS: Record<string, string> = {
  accepted_borrow_request: "Accepted Borrow Request",
  accepted_lend_offer: "Accepted Lend Offer",
  created_lend_offer: "Created Lend Offer",
  created_borrow_request: "Created Borrow Request",
  foreclosed_loan: "Foreclosed Loan",
  repaid_loan: "Repaid Loan",
  scan: "Scan",
  error: "Error",
}

export function AgentHistory({ wallet, authQuery }: Props) {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const pageSize = 10

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/agent/history?wallet=${wallet}&page=${page}&pageSize=${pageSize}&${authQuery}`)
        if (res.ok) {
          const data = await res.json()
          setActions(data.actions || [])
          setTotal(data.total || 0)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [wallet, page, authQuery])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Action History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No actions yet. Activate your agent to start.</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">TX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action, i) => (
                    <TableRow key={`${action.timestamp}-${i}`}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(action.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ACTION_LABELS[action.type] || action.type}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {action.details}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={action.status === "success" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {action.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {action.txHash ? (
                          <a
                            href={`https://solscan.io/tx/${action.txHash}${solscanClusterParam()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
