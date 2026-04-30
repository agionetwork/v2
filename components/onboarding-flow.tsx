"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function OnboardingFlow() {
  const [isOpen, setIsOpen] = React.useState(true)
  const [step, setStep] = React.useState(1)

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to AGIO NETWORK</DialogTitle>
              <DialogDescription>Let&apos;s get you started with your account setup.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  Username
                </Label>
                <Input id="username" className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={nextStep}>Next</Button>
            </DialogFooter>
          </>
        )}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Set Your Preferences</DialogTitle>
              <DialogDescription>Customize your experience on AGIO NETWORK.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">{/* Add preference settings here */}</div>
            <DialogFooter>
              <Button onClick={prevStep} variant="outline">
                Back
              </Button>
              <Button onClick={nextStep}>Next</Button>
            </DialogFooter>
          </>
        )}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>You&apos;re All Set!</DialogTitle>
              <DialogDescription>Welcome to AGIO NETWORK. Start making money lending to friends, family and business.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setIsOpen(false)}>Get Started</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

