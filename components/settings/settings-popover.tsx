"use client"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface SettingsPopoverProps {
  className?: string
}

export function SettingsPopover({ className }: SettingsPopoverProps) {
  const [customRPC, setCustomRPC] = useState("")
  const [selectedRPC, setSelectedRPC] = useState("triton1")
  const [showCustomInput, setShowCustomInput] = useState(false)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "group hover:bg-transparent focus:bg-transparent focus:ring-0 active:bg-transparent", 
            className
          )}
          style={{ backgroundColor: 'transparent' }}
        >
          <Settings className="h-5 w-5 group-hover:text-blue-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white dark:bg-gray-900">
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4 dark:text-white">Settings</h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="dark:text-white">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="dark:bg-gray-800 dark:text-white dark:border-gray-700">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    <SelectItem value="en" className="dark:text-white dark:focus:bg-gray-700">
                      <div className="flex items-center gap-2">
                        <Image src="/flags/gb.svg" alt="English" width={16} height={16} />
                        English
                      </div>
                    </SelectItem>
                    <SelectItem value="pt" className="dark:text-white dark:focus:bg-gray-700">
                      <div className="flex items-center gap-2">
                        <Image src="/flags/pt.svg" alt="Portuguese" width={16} height={16} />
                        Português
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-white">Preferred Explorer</Label>
                <Select defaultValue="solscan">
                  <SelectTrigger className="dark:bg-gray-800 dark:text-white dark:border-gray-700">
                    <SelectValue placeholder="Select explorer" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    <SelectItem value="solscan" className="dark:text-white dark:focus:bg-gray-700">Solscan</SelectItem>
                    <SelectItem value="solanaFM" className="dark:text-white dark:focus:bg-gray-700">SolanaFM</SelectItem>
                    <SelectItem value="explorer" className="dark:text-white dark:focus:bg-gray-700">Solana Explorer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700 my-4" />

              <div className="space-y-2">
                <Label className="dark:text-white">RPC Endpoint</Label>
                <RadioGroup 
                  value={selectedRPC}
                  onValueChange={(value) => {
                    setSelectedRPC(value)
                    setShowCustomInput(value === "custom")
                  }}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="triton1" id="triton1" className="data-[state=checked]:bg-blue-600 dark:border-gray-600" />
                    <Label htmlFor="triton1" className="dark:text-white">Triton RPC Pool 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="helius1" id="helius1" className="data-[state=checked]:bg-blue-600 dark:border-gray-600" />
                    <Label htmlFor="helius1" className="dark:text-white">Helius RPC Pool 1</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="triton2" id="triton2" className="data-[state=checked]:bg-blue-600 dark:border-gray-600" />
                    <Label htmlFor="triton2" className="dark:text-white">Triton RPC Pool 2</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" className="data-[state=checked]:bg-blue-600 dark:border-gray-600" />
                    <Label htmlFor="custom" className="dark:text-white">Custom</Label>
                  </div>
                </RadioGroup>

                {showCustomInput && (
                  <div className="space-y-2 mt-2">
                    <Input
                      placeholder="Custom RPC URL"
                      value={customRPC}
                      onChange={(e) => setCustomRPC(e.target.value)}
                      className="dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    />
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        // TODO: Implementar lógica para salvar o RPC customizado
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 