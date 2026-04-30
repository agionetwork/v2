"use client"

import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Loader2, Save, ChevronDown, ChevronRight, X } from "lucide-react"
import { toast } from "sonner"
import { type AgentConfig, VALID_TOKENS } from "@/lib/agent/types"
import { useTokenPrices } from "@/hooks/useTokenPrices"

function getTokenImage(token: string): string {
  if (token === "EURC") return "/images/eurc.webp"
  return `/images/${token.toLowerCase()}-logo.png`
}

interface Props {
  wallet: string
  config: AgentConfig
  onSaved: () => void
}

export function AgentConfigForm({ wallet, config, onSaved }: Props) {
  const { signMessage } = useWallet()
  const { getTokenPrice } = useTokenPrices()
  const [form, setForm] = useState<AgentConfig>(config)
  const [saving, setSaving] = useState(false)
  const [lendOpen, setLendOpen] = useState(config.lendEnabled)
  const [borrowOpen, setBorrowOpen] = useState(config.borrowEnabled)

  const update = (key: keyof AgentConfig, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleToken = (key: "lendTokens" | "lendAcceptedCollateral" | "borrowTokens" | "borrowCollateralTokens", token: string) => {
    setForm((prev) => {
      const arr = prev[key] as string[]
      return {
        ...prev,
        [key]: arr.includes(token) ? arr.filter((t) => t !== token) : [...arr, token],
      }
    })
  }

  const handleSave = async () => {
    if (!signMessage) return
    setSaving(true)
    try {
      const message = `update agent config for ${wallet} at ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch("/api/agent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature, message, config: form }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success("Configuration saved")
      onSaved()
    } catch (err: any) {
      toast.error(err.message || "Failed to save config")
    } finally {
      setSaving(false)
    }
  }

  const TokenBadgeSelect = ({
    selected,
    field,
    label,
  }: {
    selected: string[]
    field: "lendTokens" | "lendAcceptedCollateral" | "borrowTokens" | "borrowCollateralTokens"
    label: string
  }) => {
    const unselected = VALID_TOKENS.filter((t) => !selected.includes(t))
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium uppercase">{label}</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center">
          {selected.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-destructive/10 transition-colors"
              onClick={() => toggleToken(field, t)}
            >
              <img src={getTokenImage(t)} alt={t} className="w-4 h-4" />
              <span>{t}</span>
              <X className="h-3 w-3 ml-0.5 opacity-60" />
            </Badge>
          ))}
          {unselected.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-full px-2.5 py-1 transition-colors">
                  + Add
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-1" align="start">
                {unselected.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleToken(field, t)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <img src={getTokenImage(t)} alt={t} className="w-4 h-4" />
                    <span>{t}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {selected.length === 0 && unselected.length === 0 && (
            <span className="text-xs text-muted-foreground">No tokens</span>
          )}
        </div>
      </div>
    )
  }

  // Helper to show USD equivalent in selected tokens
  const usdEquivalent = (usdMin: number, usdMax: number, tokens: string[]) => {
    if (tokens.length === 0) return null
    const token = tokens[0]
    const price = getTokenPrice(token)
    if (!price || price === 0) return null
    const min = (usdMin / price).toFixed(token === "SOL" ? 2 : 0)
    const max = (usdMax / price).toFixed(token === "SOL" ? 2 : 0)
    return `~${min} - ${max} ${token}`
  }

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lending Section */}
        <div className="border rounded-lg overflow-hidden">
          <div className="w-full flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              {lendOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium text-sm">Lending Strategy</span>
            </div>
            <Switch
              checked={form.lendEnabled}
              onCheckedChange={(v) => {
                update("lendEnabled", v)
                setLendOpen(v)
              }}
            />
          </div>

          {lendOpen && (
            <div className="p-4 pt-0 space-y-4 border-t">
              <TokenBadgeSelect
                selected={form.lendTokens}
                field="lendTokens"
                label="Tokens to Lend"
              />

              <TokenBadgeSelect
                selected={form.lendAcceptedCollateral}
                field="lendAcceptedCollateral"
                label="Accepted Collateral"
              />

              {/* Amount range (USD) — number inputs */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">Amount (USD)</Label>
                <div className="flex items-center gap-2">
                  <div className="w-full space-y-1">
                    <span className="text-xs text-muted-foreground">Min</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.lendMinAmountUsd || ""}
                      onChange={(e) => update("lendMinAmountUsd", Number(e.target.value) || 0)}
                    />
                  </div>
                  <span className="text-muted-foreground text-sm mt-5">—</span>
                  <div className="w-full space-y-1">
                    <span className="text-xs text-muted-foreground">Max</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.lendMaxAmountUsd || ""}
                      onChange={(e) => update("lendMaxAmountUsd", Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                {usdEquivalent(form.lendMinAmountUsd, form.lendMaxAmountUsd, form.lendTokens) && (
                  <p className="text-xs text-muted-foreground">
                    {usdEquivalent(form.lendMinAmountUsd, form.lendMaxAmountUsd, form.lendTokens)}
                  </p>
                )}
              </div>

              {/* Collateral Ratio — dual slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Collateral Ratio: {form.lendMinCollateralRatio}% - {form.lendMaxCollateralRatio}%
                </Label>
                <Slider
                  min={150}
                  max={300}
                  step={5}
                  value={[form.lendMinCollateralRatio, form.lendMaxCollateralRatio]}
                  onValueChange={([min, max]) => {
                    update("lendMinCollateralRatio", min)
                    update("lendMaxCollateralRatio", max)
                  }}
                  className="w-full"
                />
              </div>

              {/* Min APY — single slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Minimum APY: {form.lendMinApy}%
                </Label>
                <Slider
                  min={0}
                  max={100}
                  step={0.5}
                  value={[form.lendMinApy]}
                  onValueChange={([v]) => update("lendMinApy", v)}
                  className="w-full"
                />
              </div>

              {/* Max Duration — single slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Max Period: {form.lendMaxDuration} days
                </Label>
                <Slider
                  min={1}
                  max={365}
                  step={1}
                  value={[form.lendMaxDuration]}
                  onValueChange={([v]) => update("lendMaxDuration", v)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Borrowing Section */}
        <div className="border rounded-lg overflow-hidden">
          <div className="w-full flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              {borrowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium text-sm">Borrowing Strategy</span>
            </div>
            <Switch
              checked={form.borrowEnabled}
              onCheckedChange={(v) => {
                update("borrowEnabled", v)
                setBorrowOpen(v)
              }}
            />
          </div>

          {borrowOpen && (
            <div className="p-4 pt-0 space-y-4 border-t">
              <TokenBadgeSelect
                selected={form.borrowTokens}
                field="borrowTokens"
                label="Tokens to Borrow"
              />

              <TokenBadgeSelect
                selected={form.borrowCollateralTokens}
                field="borrowCollateralTokens"
                label="Collateral Tokens"
              />

              {/* Amount range (USD) — number inputs */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">Amount (USD)</Label>
                <div className="flex items-center gap-2">
                  <div className="w-full space-y-1">
                    <span className="text-xs text-muted-foreground">Min</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.borrowMinAmountUsd || ""}
                      onChange={(e) => update("borrowMinAmountUsd", Number(e.target.value) || 0)}
                    />
                  </div>
                  <span className="text-muted-foreground text-sm mt-5">—</span>
                  <div className="w-full space-y-1">
                    <span className="text-xs text-muted-foreground">Max</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.borrowMaxAmountUsd || ""}
                      onChange={(e) => update("borrowMaxAmountUsd", Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                {usdEquivalent(form.borrowMinAmountUsd, form.borrowMaxAmountUsd, form.borrowTokens) && (
                  <p className="text-xs text-muted-foreground">
                    {usdEquivalent(form.borrowMinAmountUsd, form.borrowMaxAmountUsd, form.borrowTokens)}
                  </p>
                )}
              </div>

              {/* Collateral Ratio — dual slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Collateral Ratio: {form.borrowMinCollateralRatio}% - {form.borrowMaxCollateralRatio}%
                </Label>
                <Slider
                  min={150}
                  max={300}
                  step={5}
                  value={[form.borrowMinCollateralRatio, form.borrowMaxCollateralRatio]}
                  onValueChange={([min, max]) => {
                    update("borrowMinCollateralRatio", min)
                    update("borrowMaxCollateralRatio", max)
                  }}
                  className="w-full"
                />
              </div>

              {/* Max APY — single slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Maximum APY: {form.borrowMaxApy}%
                </Label>
                <Slider
                  min={0}
                  max={100}
                  step={0.5}
                  value={[form.borrowMaxApy]}
                  onValueChange={([v]) => update("borrowMaxApy", v)}
                  className="w-full"
                />
              </div>

              {/* Max Duration — single slider */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium uppercase">
                  Max Period: {form.borrowMaxDuration} days
                </Label>
                <Slider
                  min={1}
                  max={365}
                  step={1}
                  value={[form.borrowMaxDuration]}
                  onValueChange={([v]) => update("borrowMaxDuration", v)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Update
        </Button>
      </CardContent>
    </Card>
  )
}
