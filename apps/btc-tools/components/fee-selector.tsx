'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getRecommendedFees } from '@/lib/fee-calculator'

interface FeeSelectorProps {
  feeRate: number
  onChange: (feeRate: number) => void
  network?: string
}

export function FeeSelector({ feeRate, onChange, network = 'mainnet' }: FeeSelectorProps) {
  const [recommendedFees, setRecommendedFees] = useState<{
    slow: number
    medium: number
    fast: number
    minimum: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecommendedFees(network).then((fees) => {
      setRecommendedFees(fees)
      setLoading(false)
      // Set default to medium fee
      if (feeRate === 0) {
        onChange(fees.medium)
      }
    })
  }, [network])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Rate</CardTitle>
        <CardDescription>Select transaction fee rate (sat/vB)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading recommended fees...</div>
          ) : recommendedFees ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onChange(recommendedFees.slow)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  feeRate === recommendedFees.slow
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">Slow</div>
                <div className="text-sm text-muted-foreground">
                  {recommendedFees.slow} sat/vB
                </div>
              </button>
              <button
                onClick={() => onChange(recommendedFees.medium)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  feeRate === recommendedFees.medium
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">Medium</div>
                <div className="text-sm text-muted-foreground">
                  {recommendedFees.medium} sat/vB
                </div>
              </button>
              <button
                onClick={() => onChange(recommendedFees.fast)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  feeRate === recommendedFees.fast
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">Fast</div>
                <div className="text-sm text-muted-foreground">
                  {recommendedFees.fast} sat/vB
                </div>
              </button>
            </div>
          ) : null}

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Custom Fee Rate (sat/vB)
            </label>
            <Input
              type="number"
              min="1"
              value={feeRate || ''}
              onChange={(e) => onChange(parseInt(e.target.value) || 1)}
              placeholder="Enter custom fee rate"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

