'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ExternalLink } from 'lucide-react'

export type BroadcastMethod = 'mempool' | 'mara_slipstream' | 'manual'

interface BroadcastMethodSelectorProps {
  method: BroadcastMethod
  onChange: (method: BroadcastMethod) => void
}

export function BroadcastMethodSelector({
  method,
  onChange,
}: BroadcastMethodSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Broadcast Method</CardTitle>
        <CardDescription>Choose how to broadcast your transaction</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={method} onValueChange={(value) => onChange(value as BroadcastMethod)}>
          <div className="flex items-center space-x-2 space-y-2">
            <RadioGroupItem value="mempool" id="mempool" />
            <Label htmlFor="mempool" className="flex-1 cursor-pointer">
              <div className="font-medium">Mempool</div>
              <div className="text-sm text-muted-foreground">
                Standard mempool broadcast
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2 space-y-2">
            <RadioGroupItem value="mara_slipstream" id="mara_slipstream" />
            <Label htmlFor="mara_slipstream" className="flex-1 cursor-pointer">
              <div className="font-medium">MARA Slipstream</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                Learn more
                <ExternalLink className="h-3 w-3" />
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2 space-y-2">
            <RadioGroupItem value="manual" id="manual" />
            <Label htmlFor="manual" className="flex-1 cursor-pointer">
              <div className="font-medium">Manual Broadcast</div>
              <div className="text-sm text-muted-foreground">
                Skip broadcast and download signed transaction
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

