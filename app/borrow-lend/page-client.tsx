"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BorrowLoanCreation } from "@/components/borrow-loan-creation"
import { LendLoanCreation } from "@/components/lend-loan-creation"

export default function BorrowLendPageClient() {
  const [activeTab, setActiveTab] = useState("borrow")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="max-w-md mx-auto w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="borrow">Borrow</TabsTrigger>
        <TabsTrigger value="lend">Lend</TabsTrigger>
      </TabsList>
      <TabsContent value="borrow">
        <BorrowLoanCreation />
      </TabsContent>
      <TabsContent value="lend">
        <LendLoanCreation />
      </TabsContent>
    </Tabs>
  )
}
