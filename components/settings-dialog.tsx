"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Cog } from "lucide-react"

export function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [customRpc, setCustomRpc] = useState("")
  const [rpcType, setRpcType] = useState("default")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Cog className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-blue-600 text-white">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select>
              <SelectTrigger className="bg-white text-blue-600">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-white/20" />

          <div className="space-y-2">
            <Label>RPC Endpoint</Label>
            <RadioGroup 
              defaultValue="default" 
              className="flex gap-4"
              onValueChange={setRpcType}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="default" id="default" className="border-white text-white" />
                <Label htmlFor="default" className="text-white">Default</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" className="border-white text-white" />
                <Label htmlFor="custom" className="text-white">Custom</Label>
              </div>
            </RadioGroup>
          </div>

          {rpcType === "custom" && (
            <div className="space-y-2">
              <Label>Custom RPC</Label>
              <div className="flex gap-2">
                <Input
                  value={customRpc}
                  onChange={(e) => setCustomRpc(e.target.value)}
                  placeholder="Enter custom RPC URL"
                  className="bg-white text-blue-600"
                />
                <Button className="bg-white text-blue-600 hover:bg-gray-100">
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 