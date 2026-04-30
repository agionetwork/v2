"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Icons } from "@/components/ui/icons"

export function LoanCreation() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [loanAmount, setLoanAmount] = useState(1000)
  const [loanTerm, setLoanTerm] = useState(30)
  const [apy, setApy] = useState(5)
  const [token, setToken] = useState("SOL")
  const [tokenCollateral, setTokenCollateral] = useState("SOL")
  const [collateralAmount, setCollateralAmount] = useState(1000)
  const [receiverAddress, setReceiverAddress] = useState("")
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false)
  const [operationType, setOperationType] = useState("LEND")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleCreateLoan = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 3000)
      resetForm()
    } catch (error) {
      console.error("Error creating loan:", error)
      setErrors({ submit: "Error creating loan. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setLoanAmount(1000)
    setLoanTerm(30)
    setApy(5)
    setToken("SOL")
    setTokenCollateral("SOL")
    setCollateralAmount(1000)
    setReceiverAddress("")
    setErrors({})
  }

  const handleSetWalletAddress = (address: string) => {
    setReceiverAddress(address)
    setIsWalletDialogOpen(false)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (loanAmount <= 0) newErrors.loanAmount = "Value must be greater than 0"
    if (loanTerm < 1) newErrors.loanTerm = "Minimum term is 1 day"
    if (apy < 0) newErrors.apy = "APY cannot be negative"
    if (collateralAmount <= 0) newErrors.collateralAmount = "Collateral must be greater than 0"
    if (!receiverAddress) newErrors.receiverAddress = "Wallet address is required"
    if (receiverAddress && !receiverAddress.startsWith("0x")) {
      newErrors.receiverAddress = "Invalid wallet address format"
    }
    
    // Amount cannot be equal to Collateral
    if (token === tokenCollateral) {
      newErrors.tokenCollateral = "Amount token cannot be the same as Collateral token"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden h-[calc(100vh-8rem)]">
      <CardHeader className="bg-agio rounded-t-xl text-center py-2 relative">
        <CardTitle className="text-xl font-bold text-white text-center">
          CREATE OFFER
        </CardTitle>
        <CardDescription className="text-white text-center text-sm">
          Set your loan terms and rates.
        </CardDescription>
        {isSuccess && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-4 py-2 rounded-md animate-fade-out">
            Loan created successfully!
          </div>
        )}
      </CardHeader>
      <CardContent className="py-3 overflow-y-auto">
        <div className="space-y-4">
          {/* Operation Type Section - Centered */}
          <div className="max-w-sm mx-auto">
            <Label htmlFor="operation-type" className="text-lg font-medium text-foreground dark:text-white text-center block">
              OPERATION TYPE
            </Label>
            <Select value={operationType} onValueChange={setOperationType}>
              <SelectTrigger className="w-full h-9 border-agio focus:ring-agio">
                <SelectValue placeholder="Select operation type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="LEND">LEND</SelectItem>
                <SelectItem value="BORROW">BORROW</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Two Columns Layout */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="token" className="text-base font-medium text-foreground">
                  TOKEN
                </Label>
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="SOL">$SOL</SelectItem>
                    <SelectItem value="USDC">$USDC</SelectItem>
                    <SelectItem value="USDT">$USDT</SelectItem>
                    <SelectItem value="mSOL">$mSOL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loan-amount" className="text-base font-medium text-foreground">
                  LOAN AMOUNT ({token})
                </Label>
                <Input
                  id="loan-amount"
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="border-agio focus:ring-agio h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-collateral" className="text-base font-medium text-foreground">
                  TOKEN COLLATERAL
                </Label>
                <Select value={tokenCollateral} onValueChange={setTokenCollateral}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Select collateral token" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="SOL">$SOL</SelectItem>
                    <SelectItem value="USDC">$USDC</SelectItem>
                    <SelectItem value="USDT">$USDT</SelectItem>
                    <SelectItem value="mSOL">$mSOL</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tokenCollateral && (
                  <p className="text-red-500 text-sm mt-1">{errors.tokenCollateral}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="collateral-amount" className="text-base font-medium text-foreground">
                  COLLATERAL AMOUNT ({tokenCollateral})
                </Label>
                <Input
                  id="collateral-amount"
                  type="number"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(Number(e.target.value))}
                  className="border-agio focus:ring-agio h-9"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="agio" className="text-base font-medium text-foreground">
                  AGIO (APY %): {apy}
                </Label>
                <Slider
                  id="agio"
                  min={0}
                  max={100}
                  step={0.1}
                  value={[apy]}
                  onValueChange={(value) => setApy(value[0])}
                  className="bg-agio-light"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loan-term" className="text-base font-medium text-foreground">
                  LOAN TERM (DAYS): {loanTerm}
                </Label>
                <Slider
                  id="loan-term"
                  min={1}
                  max={365}
                  step={1}
                  value={[loanTerm]}
                  onValueChange={(value) => setLoanTerm(value[0])}
                  className="bg-agio-light"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wallet" className="text-base font-medium text-foreground">
                  SEND OFFER:
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="wallet"
                    type="text"
                    value={receiverAddress}
                    readOnly
                    placeholder="CLICK IN WALLET TO SET ADDRESS"
                    className="flex-grow border-agio focus:ring-agio h-9"
                  />
                  <Dialog open={isWalletDialogOpen} onOpenChange={setIsWalletDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-shrink-0 h-9 px-3">
                        WALLET
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enter the Wallet Address</DialogTitle>
                        <DialogDescription>Please enter the public address of the receiver for this loan.</DialogDescription>
                      </DialogHeader>
                      <Input
                        placeholder="Enter wallet address"
                        value={receiverAddress}
                        onChange={(e) => setReceiverAddress(e.target.value)}
                      />
                      <DialogFooter>
                        <Button onClick={() => handleSetWalletAddress(receiverAddress)}>Set Address</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium mb-2 dark:text-white">Loan Summary</h3>
                <div className="space-y-1 text-sm dark:text-white">
                  <p>Total Repayment: {(loanAmount * (1 + (apy / 100) * (loanTerm / 365))).toFixed(2)} {token}</p>
                  <p>Interest: {(loanAmount * (apy / 100) * (loanTerm / 365)).toFixed(2)} {token}</p>
                  <p>Daily Interest: {((apy / 100) * loanAmount / 365).toFixed(2)} {token}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="py-2 flex justify-center items-center gap-4 bg-white">
        <Button
          variant="outline"
          onClick={resetForm}
          className="px-8 hover:bg-gray-100"
          disabled={isLoading}
        >
          Reset
        </Button>
        <Button 
          onClick={handleCreateLoan}
          className="bg-agio hover:bg-agio-dark text-white h-9 text-lg px-16"
          disabled={isLoading || Object.keys(errors).length > 0}
        >
          {isLoading ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Create Loan"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

