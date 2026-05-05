"use client"

import { useEffect, useState, Suspense, useMemo } from "react"
import { useTheme } from "next-themes"
import { useWalletTokens } from "../../hooks/useWalletTokens"
import { useTokenPrices } from "../../hooks/useTokenPrices"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Badge, type BadgeProps } from "../../components/ui/badge"
import { Button, type ButtonProps } from "../../components/ui/button"
import { ResponsiveLine } from "@nivo/line"
import { ResponsivePie } from '@nivo/pie'
import { useSearchParams, useRouter } from "next/navigation"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip"
import BorrowDashboard from "../../components/dashboard/borrow-dashboard"
import LendDashboard from "../../components/dashboard/lend-dashboard"
import LoanViewModal from "../../components/dashboard/loan-view-modal"
import { GetFaucetsButton } from "../../components/dashboard/get-faucets-button"
import {
  LiquidityIcon,
  AssetDonutIcon,
  LoanChartIcon,
  ActivityPulseIcon,
} from "../../components/dashboard/three-icons"
import Link from "next/link"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletContext } from "@/components/wallet-provider"
import { useLoans, getStatusLabel, LoanStatus, type ParsedLoan } from "../../hooks/useLoans"
import { ProfileCard } from "@/components/socialfi/profile-card"
import { useWalletProfile } from "@/hooks/useWalletProfile"

// Accepted platform tokens
const ACCEPTED_TOKENS = ['SOL', 'USDC', 'EURC', 'bSOL'] as const

const getTokenDisplaySymbol = (symbol: string): string => {
  if (symbol === 'bSOL') return 'agioSOL'
  return symbol
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

/**
 * Small `?` superscript next to an overview-card title. On hover it surfaces
 * the description text that previously lived in <CardDescription>, so the
 * card header reads as a single tight line of title + icon + help glyph.
 */
function TitleHelp({ description }: { description: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none -translate-y-1.5 leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200"
            aria-label={description}
          >
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CounterpartyName({ address }: { address: string | null }) {
  const { displayName, profileWallet } = useWalletProfile(address)
  if (!address) return <>Open offer</>
  return (
    <Link
      href={`/socialfi/profile/${profileWallet || address}`}
      className="text-blue-600 dark:text-blue-400 hover:underline"
    >
      {displayName || shortenAddress(address)}
    </Link>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get("tab") || "overview"
  const [activeTab, setActiveTab] = useState(tab)
  const { theme } = useTheme()
  const { tokens, isLoading, error } = useWalletTokens()
  const { prices } = useTokenPrices()
  const [mounted, setMounted] = useState(false)
  const { publicKey, connected } = useWallet()
  const [selectedLoan, setSelectedLoan] = useState<ParsedLoan | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { loans, myLoans, myBorrowedLoans, myLentLoans, loading: loansLoading, error: loansError, refetch, isMyWallet } = useLoans()

  // Compute summary from real on-chain data (active + historical loans)
  const loanSummary = useMemo(() => {
    const activeOrDone = [LoanStatus.Accepted, LoanStatus.Repaid, LoanStatus.Foreclosed]
    const borrowed = myBorrowedLoans.filter(l => activeOrDone.includes(l.status))
    const lent = myLentLoans.filter(l => activeOrDone.includes(l.status))

    const getTokenPrice = (symbol: string): number => prices[symbol]?.price || 0
    const SECONDS_PER_YEAR = 365 * 86400
    const nowSec = Math.floor(Date.now() / 1000)

    // Calculate simple interest for a loan
    const calcInterest = (loan: ParsedLoan, elapsed: number): number =>
      loan.debtAmountUi * loan.apy / 100 * elapsed / SECONDS_PER_YEAR

    // Interest Expense (borrower):
    //   Repaid → interest paid over full duration
    //   Foreclosed → collateral lost
    //   Accepted (active) → accrued interest so far
    let interestExpenseUsd = 0
    for (const loan of borrowed) {
      if (loan.status === LoanStatus.Repaid) {
        interestExpenseUsd += calcInterest(loan, loan.duration) * getTokenPrice(loan.debtTokenSymbol)
      } else if (loan.status === LoanStatus.Foreclosed) {
        interestExpenseUsd += loan.collateralAmountUi * getTokenPrice(loan.collateralTokenSymbol)
      } else if (loan.status === LoanStatus.Accepted && loan.start) {
        const elapsed = Math.max(0, nowSec - loan.start)
        interestExpenseUsd += calcInterest(loan, elapsed) * getTokenPrice(loan.debtTokenSymbol)
      }
    }

    // Interest Earned (lender):
    //   Repaid → interest received over full duration
    //   Foreclosed → collateral gained
    //   Accepted (active) → accruing interest so far
    let interestEarnedUsd = 0
    for (const loan of lent) {
      if (loan.status === LoanStatus.Repaid) {
        interestEarnedUsd += calcInterest(loan, loan.duration) * getTokenPrice(loan.debtTokenSymbol)
      } else if (loan.status === LoanStatus.Foreclosed) {
        interestEarnedUsd += loan.collateralAmountUi * getTokenPrice(loan.collateralTokenSymbol)
      } else if (loan.status === LoanStatus.Accepted && loan.start) {
        const elapsed = Math.max(0, nowSec - loan.start)
        interestEarnedUsd += calcInterest(loan, elapsed) * getTokenPrice(loan.debtTokenSymbol)
      }
    }

    // Total Borrowed/Lent in USD (not raw token sums across different tokens)
    const totalBorrowedUsd = borrowed.reduce(
      (sum, l) => sum + l.debtAmountUi * getTokenPrice(l.debtTokenSymbol), 0
    )
    const totalLentUsd = lent.reduce(
      (sum, l) => sum + l.debtAmountUi * getTokenPrice(l.debtTokenSymbol), 0
    )

    return {
      totalBorrowedUsd,
      totalLentUsd,
      interestExpenseUsd,
      interestEarnedUsd,
    }
  }, [myBorrowedLoans, myLentLoans, prices])

  // Recent activity from real loans
  const recentActivity = useMemo(() => {
    return myLoans
      .sort((a, b) => (b.start || 0) - (a.start || 0))
      .slice(0, 5)
  }, [myLoans])

  // Loan history chart data: cumulative borrow/lend over time
  // Includes Pending offers (using current time as date since they have no start timestamp)
  const loanChartData = useMemo(() => {
    const validStatuses = [LoanStatus.Pending, LoanStatus.Accepted, LoanStatus.Repaid, LoanStatus.Foreclosed]
    const now = Date.now()
    const borrowedWithDates = myBorrowedLoans
      .filter(l => validStatuses.includes(l.status))
      .map(l => ({ date: l.start ? l.start * 1000 : now, amount: l.debtAmountUi, loan: l }))
      .sort((a, b) => a.date - b.date)

    const lentWithDates = myLentLoans
      .filter(l => validStatuses.includes(l.status))
      .map(l => ({ date: l.start ? l.start * 1000 : now, amount: l.debtAmountUi, loan: l }))
      .sort((a, b) => a.date - b.date)

    if (borrowedWithDates.length === 0 && lentWithDates.length === 0) return []

    const formatDate = (ts: number) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    // Build cumulative data points with origin padding for single-point series
    const buildPoints = (items: typeof borrowedWithDates) => {
      let cum = 0
      const points = items.map(item => {
        cum += item.amount
        return {
          x: formatDate(item.date),
          y: Math.round(cum * 100) / 100,
          loan: item.loan,
        }
      })
      // Pad with origin point if only 1 data point so the line stretches across the chart
      if (points.length === 1) {
        const originDate = items[0].date - 86400000 // 1 day before
        points.unshift({ x: formatDate(originDate), y: 0, loan: undefined as any })
      }
      return points
    }

    const borrowPoints = buildPoints(borrowedWithDates)
    const lendPoints = buildPoints(lentWithDates)

    const series: any[] = []
    if (borrowPoints.length > 0) {
      series.push({ id: 'Borrowed', data: borrowPoints, color: '#3B82F6' })
    }
    if (lendPoints.length > 0) {
      series.push({ id: 'Lent', data: lendPoints, color: '#1E3A8A' })
    }
    return series
  }, [myBorrowedLoans, myLentLoans])

  // Filter only accepted platform tokens
  const acceptedTokens = useMemo(() => {
    return tokens.filter(token => {
      const isAccepted = ACCEPTED_TOKENS.includes(token.symbol as any)
      return isAccepted && token.balance > 0
    })
  }, [tokens])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  const handleViewLoan = (loan: ParsedLoan) => {
    setSelectedLoan(loan)
    setIsModalOpen(true)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`/dashboard?tab=${value}`)
  }

  const titleColor = 'text-blue-600 dark:text-blue-200'
  const descriptionColor = 'text-gray-700 dark:text-gray-300'

  const chartAxisColor = theme === 'dark' ? '#e0e7ef' : '#374151'

  const getAssetDistributionData = () => {
    if (acceptedTokens.length === 0) return []

    const totalValue = acceptedTokens.reduce((sum, token) => {
      const price = prices[token.symbol]?.price || 0
      const tokenValue = token.balance * price
      if (isNaN(tokenValue) || !isFinite(tokenValue)) return sum
      return sum + tokenValue
    }, 0)

    if (totalValue <= 0 || isNaN(totalValue) || !isFinite(totalValue)) return []

    return acceptedTokens
      .filter(token => {
        const price = prices[token.symbol]?.price || 0
        const tokenValue = token.balance * price
        return token.balance > 0 && tokenValue > 0 && !isNaN(tokenValue) && isFinite(tokenValue)
      })
      .map(token => {
        const price = prices[token.symbol]?.price || 0
        const tokenValue = token.balance * price
        let value = totalValue > 0 ? (tokenValue / totalValue) * 100 : 0
        value = isNaN(value) || !isFinite(value) ? 0 : Math.max(0, Math.round(value * 100) / 100)

        // Brand-aligned palette: stays in the blue/violet family used by the
        // glass cards so the donut reads as part of the same surface family
        // rather than a foreign chart widget.
        const colors: { [key: string]: string } = {
          'SOL': '#4A90FF',
          'USDC': '#1358EC',
          'EURC': '#60A5FA',
          'bSOL': '#7C3AED',
        }

        return {
          id: token.symbol,
          value: value,
          color: colors[token.symbol] || '#6B7280'
        }
      })
      .filter(item => item.value > 0)
  }

  const getTokenLogo = (symbol: string) => {
    const logoMap: { [key: string]: string } = {
      'SOL': '/images/sol-logo.png',
      'USDC': '/images/usdc-logo.png',
      'USDT': '/images/usdt-logo.png',
      'EURC': '/images/eurc-logo.png',
      'bSOL': '/images/bluebgagio.png',
    }
    return logoMap[symbol] || '/images/placeholder-logo.png'
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <ProfileCard />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="borrow">Borrow</TabsTrigger>
            <TabsTrigger value="lend">Lend</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Your Liquidity */}
            <Card className="border-2 border-gray-200 dark:border-white/20 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
              <CardHeader className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className={`text-2xl font-bold flex items-center gap-2 ${titleColor}`}>
                      <LiquidityIcon size={36} />
                      Your Liquidity
                      <TitleHelp description="Your assets available for loans and investments" />
                    </CardTitle>
                  </div>
                  <GetFaucetsButton />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-4">Error loading tokens: {error}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {acceptedTokens.map((token) => {
                      const price = prices[token.symbol]?.price || 0
                      const valueUSD = token.balance * price
                      return (
                        <Card key={token.symbol} className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow bg-transparent">
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm flex-shrink-0">
                              <img
                                src={getTokenLogo(token.symbol)}
                                alt={`${token.symbol} logo`}
                                className="w-8 h-8 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png' }}
                              />
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-xl font-bold text-gray-900 dark:text-white">{token.balance.toFixed(4)} ${getTokenDisplaySymbol(token.symbol)}</div>
                              <div className="text-sm font-semibold text-green-600 dark:text-green-400">{valueUSD.toFixed(2)} $USD</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">1 ${getTokenDisplaySymbol(token.symbol)} = {price.toFixed(2)} $USD</div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Link href={`/loan-offers?type=borrow&token=${token.symbol}`}>
                                <Button size="sm" variant="destructive" className="text-xs w-full">
                                  Borrow
                                </Button>
                              </Link>
                              <Link href={`/loan-offers?type=lend&token=${token.symbol}`}>
                                <Button size="sm" className="text-xs w-full">
                                  Lend
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}

                    {acceptedTokens.length === 0 && !isLoading && !error && (
                      <Card className="border border-gray-200 dark:border-gray-700 bg-transparent col-span-full">
                        <CardContent className="p-8 text-center">
                          <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {(connected || publicKey) ? "No accepted tokens found" : "Connect your wallet"}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {(connected || publicKey)
                                  ? "Your wallet does not have any accepted platform tokens (SOL, USDC, EURC, agioSOL) or the balances are zero"
                                  : "Connect your wallet to see your accepted platform tokens (SOL, USDC, EURC, agioSOL)"
                                }
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Asset Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200 dark:border-white/20 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className={`text-xl font-bold flex items-center gap-2 ${titleColor}`}>
                    <AssetDonutIcon size={32} />
                    Asset Distribution
                    <TitleHelp description="Composition of your portfolio" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="h-56">
                    {(() => {
                      const chartData = getAssetDistributionData()
                      const validData = chartData.filter(item =>
                        item && typeof item.value === 'number' && !isNaN(item.value) && isFinite(item.value) && item.value >= 0
                      )

                      if (validData.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <p className="text-sm">No asset distribution data available</p>
                          </div>
                        )
                      }

                      return (
                        <ResponsivePie
                          data={validData}
                          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                          innerRadius={0.62}
                          padAngle={1.4}
                          cornerRadius={6}
                          activeOuterRadiusOffset={6}
                          colors={{ datum: 'data.color' }}
                          borderWidth={0}
                          borderColor={{ from: 'color' }}
                          arcLinkLabelsSkipAngle={10}
                          arcLinkLabelsTextColor={chartAxisColor}
                          arcLinkLabelsThickness={2}
                          arcLinkLabelsColor={{ from: 'color' }}
                          enableArcLabels={false}
                          tooltip={({ datum }) => (
                            <div
                              className="rounded-lg px-3 py-2 text-sm"
                              style={{
                                background: theme === 'dark'
                                  ? 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0)), rgba(8,14,36,0.96)'
                                  : 'linear-gradient(135deg, rgba(74,144,255,0.08), rgba(255,255,255,0)), rgba(255,255,255,0.98)',
                                border: theme === 'dark'
                                  ? '1px solid rgba(74,144,255,0.22)'
                                  : '1px solid rgba(74,144,255,0.18)',
                                boxShadow: '0 8px 24px -8px rgba(74,144,255,0.25), 0 1px 0 rgba(255,255,255,0.08) inset',
                                backdropFilter: 'blur(8px)',
                                color: theme === 'dark' ? '#E2E8F0' : '#0A1230',
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: datum.color, boxShadow: `0 0 8px ${datum.color}` }}></div>
                                <span className="font-medium">{getTokenDisplaySymbol(datum.id as string)}: {datum.value.toFixed(2)}%</span>
                              </div>
                            </div>
                          )}
                        />
                      )
                    })()}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {getAssetDistributionData()
                        .filter(item => item && typeof item.value === 'number' && !isNaN(item.value) && item.value > 0)
                        .map((item) => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-700">
                              <img
                                src={getTokenLogo(item.id)}
                                alt={`${item.id} logo`}
                                className="w-4 h-4 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png' }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              ${getTokenDisplaySymbol(item.id)} ({item.value.toFixed(2)}%)
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loan Summary */}
              <Card className="border-2 border-gray-200 dark:border-white/20 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className={`text-xl font-bold flex items-center gap-2 ${titleColor}`}>
                    <LoanChartIcon size={32} />
                    Loan Overview
                    <TitleHelp description="Summary of your loan activity" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  {loansLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : loanChartData.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                      <div className="text-center">
                        <p className="text-lg font-medium">No loan history yet</p>
                        <p className="text-sm mt-1">Your offers and loans will appear here as a chart</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-72">
                      <ResponsiveLine
                        data={loanChartData}
                        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
                        curve="catmullRom"
                        axisBottom={{
                          tickSize: 4,
                          tickPadding: 6,
                          tickRotation: -30,
                          legendOffset: 40,
                          legendPosition: 'middle',
                        }}
                        axisLeft={{
                          tickSize: 4,
                          tickPadding: 6,
                          tickRotation: 0,
                          legend: 'Amount',
                          legendOffset: -50,
                          legendPosition: 'middle',
                        }}
                        colors={({ id }) => id === 'Borrowed' ? '#4A90FF' : '#1358EC'}
                        lineWidth={3}
                        enableArea={true}
                        areaOpacity={theme === 'dark' ? 0.18 : 0.12}
                        pointSize={9}
                        pointColor={theme === 'dark' ? '#0A1230' : '#FFFFFF'}
                        pointBorderWidth={2.5}
                        pointBorderColor={{ from: 'serieColor' }}
                        enablePointLabel={false}
                        useMesh={true}
                        tooltip={({ point }) => {
                          const d = point.data as any
                          const loan = d.loan as ParsedLoan | undefined
                          const seriesColor = (point as any).serieColor as string | undefined
                          return (
                            <div
                              className="rounded-lg p-3 text-sm"
                              style={{
                                background: theme === 'dark'
                                  ? 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0)), rgba(8,14,36,0.96)'
                                  : 'linear-gradient(135deg, rgba(74,144,255,0.08), rgba(255,255,255,0)), rgba(255,255,255,0.98)',
                                border: theme === 'dark'
                                  ? '1px solid rgba(74,144,255,0.22)'
                                  : '1px solid rgba(74,144,255,0.18)',
                                boxShadow: '0 8px 24px -8px rgba(74,144,255,0.25), 0 1px 0 rgba(255,255,255,0.08) inset',
                                backdropFilter: 'blur(8px)',
                                color: theme === 'dark' ? '#E2E8F0' : '#0A1230',
                              }}
                            >
                              <div className="font-semibold mb-1 flex items-center gap-2">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: seriesColor, boxShadow: `0 0 6px ${seriesColor}` }}
                                />
                                {String(point.seriesId)}
                              </div>
                              <div className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Date: {point.data.xFormatted}</div>
                              <div className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Cumulative: {point.data.yFormatted}</div>
                              {loan && (
                                <>
                                  <div className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {loan.debtAmountUi.toFixed(2)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}
                                  </div>
                                  <div className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>APY: {loan.apy}%</div>
                                  <div className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Status: {getStatusLabel(loan.status)}</div>
                                </>
                              )}
                            </div>
                          )
                        }}
                        theme={{
                          axis: {
                            domain: { line: { stroke: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(10,18,48,0.10)', strokeWidth: 1 } },
                            ticks: {
                              line: { stroke: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(10,18,48,0.10)', strokeWidth: 1 },
                              text: { fill: chartAxisColor, fontSize: 11 },
                            },
                            legend: { text: { fill: chartAxisColor, fontSize: 12 } },
                          },
                          grid: {
                            line: {
                              stroke: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(10,18,48,0.06)',
                              strokeWidth: 1,
                            },
                          },
                          crosshair: {
                            line: {
                              stroke: '#4A90FF',
                              strokeWidth: 1,
                              strokeOpacity: 0.5,
                            },
                          },
                        }}
                        legends={[
                          {
                            anchor: 'bottom',
                            direction: 'row',
                            justify: false,
                            translateX: 0,
                            translateY: 46,
                            itemsSpacing: 20,
                            itemDirection: 'left-to-right',
                            itemWidth: 80,
                            itemHeight: 16,
                            itemTextColor: chartAxisColor,
                            symbolSize: 10,
                            symbolShape: 'circle',
                          }
                        ]}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Loan Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total Borrowed</p>
                      <p className="text-2xl font-bold">${loanSummary.totalBorrowedUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total Lent</p>
                      <p className="text-2xl font-bold">${loanSummary.totalLentUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-700 to-blue-800 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Interest Expense</p>
                      <p className="text-2xl font-bold text-red-500">${loanSummary.interestExpenseUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Interest Earned</p>
                      <p className="text-2xl font-bold text-green-600">${loanSummary.interestEarnedUsd.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="border-2 border-gray-200 dark:border-white/20 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
              <CardHeader className="relative z-10">
                <CardTitle className={`text-xl font-bold flex items-center gap-2 ${titleColor}`}>
                  <ActivityPulseIcon size={32} />
                  Recent Activity
                  <TitleHelp description="Your most recent loan activity" />
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                {loansLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : loansError ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <p className="text-lg font-medium">Failed to load activity</p>
                      <p className="text-sm mt-1">Could not fetch loan data from the network</p>
                      <Button onClick={() => refetch()} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">Retry</Button>
                    </div>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <p className="text-lg font-medium">No activity yet</p>
                      <p className="text-sm mt-1">Your loan transactions will appear here</p>
                      <Link href="/borrow-lend">
                        <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">Create Your First Loan</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((loan) => {
                      const isBorrower = isMyWallet(loan.borrower)
                      const counterparty = isBorrower ? loan.lender : loan.borrower
                      return (
                        <div key={loan.publicKey} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-700">
                              <img
                                src={getTokenLogo(loan.debtTokenSymbol)}
                                alt={`${loan.debtTokenSymbol} logo`}
                                className="w-8 h-8 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png' }}
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {isBorrower ? 'Borrowed' : 'Lent'} {loan.debtAmountUi.toFixed(2)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <CounterpartyName address={counterparty} /> - APY: {loan.apy}%
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:space-x-2">
                            <Badge
                              className={
                                loan.status === LoanStatus.Accepted
                                  ? "text-xs bg-green-600 hover:bg-green-700 text-white border-transparent"
                                  : loan.status === LoanStatus.Repaid
                                  ? "text-xs bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                                  : loan.status === LoanStatus.Foreclosed
                                  ? "text-xs bg-red-600 hover:bg-red-700 text-white border-transparent"
                                  : "text-xs"
                              }
                              variant={
                                loan.status === LoanStatus.Accepted ||
                                loan.status === LoanStatus.Repaid ||
                                loan.status === LoanStatus.Foreclosed
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {getStatusLabel(loan.status)}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewLoan(loan)}
                              className="text-xs"
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="borrow">
            <BorrowDashboard />
          </TabsContent>

          <TabsContent value="lend">
            <LendDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {selectedLoan && (
        <LoanViewModal
          loan={selectedLoan}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRepaySuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
          onCancelSuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
          onAcceptSuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function WalletGate() {
  const { isConnected } = useWalletContext()

  if (!isConnected) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <svg className="h-12 w-12 mx-auto mb-4 opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
            <p className="text-xl font-semibold mb-2">Connect your wallet</p>
            <p className="text-sm">Connect your wallet to access your Dashboard.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <DashboardContent />
}

export default function DashboardPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <WalletGate />
    </Suspense>
  )
}
