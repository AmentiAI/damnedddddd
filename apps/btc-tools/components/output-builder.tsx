'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, FileCode } from 'lucide-react'
import { formatSats } from '@/lib/utils'

export interface TxOutput {
  address: string
  amount: number
  type: 'standard' | 'op_return' | 'script'
  script?: string
  data?: string
}

interface OutputBuilderProps {
  outputs: TxOutput[]
  onChange: (outputs: TxOutput[]) => void
}

export function OutputBuilder({ outputs, onChange }: OutputBuilderProps) {
  const addOutput = () => {
    onChange([
      ...outputs,
      {
        address: '',
        amount: 0,
        type: 'standard',
      },
    ])
  }

  const removeOutput = (index: number) => {
    onChange(outputs.filter((_, i) => i !== index))
  }

  const updateOutput = (index: number, updates: Partial<TxOutput>) => {
    const newOutputs = [...outputs]
    newOutputs[index] = { ...newOutputs[index], ...updates }
    onChange(newOutputs)
  }

  const addOpReturn = () => {
    onChange([
      ...outputs,
      {
        address: '',
        amount: 0,
        type: 'op_return',
        data: '',
      },
    ])
  }

  const addScript = () => {
    onChange([
      ...outputs,
      {
        address: '',
        amount: 0,
        type: 'script',
        script: '',
      },
    ])
  }

  const totalOutput = outputs.reduce((sum, out) => sum + (out.amount || 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Outputs</span>
          <span className="text-sm font-normal text-muted-foreground">
            Total: {formatSats(totalOutput)} sats
          </span>
        </CardTitle>
        <CardDescription>
          Add outputs for your transaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {outputs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No outputs added yet
            </div>
          ) : (
            outputs.map((output, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Output #{index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOutput(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {output.type === 'standard' && (
                    <>
                      <div>
                        <label className="text-sm text-muted-foreground">Address</label>
                        <Input
                          value={output.address}
                          onChange={(e) => updateOutput(index, { address: e.target.value })}
                          placeholder="bc1q..."
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Amount (sats)</label>
                        <Input
                          type="number"
                          value={output.amount || ''}
                          onChange={(e) =>
                            updateOutput(index, { amount: parseInt(e.target.value) || 0 })
                          }
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}

                  {output.type === 'op_return' && (
                    <div>
                      <label className="text-sm text-muted-foreground">OP_RETURN Data</label>
                      <Input
                        value={output.data || ''}
                        onChange={(e) => updateOutput(index, { data: e.target.value })}
                        placeholder="Enter data to encode"
                      />
                    </div>
                  )}

                  {output.type === 'script' && (
                    <div>
                      <label className="text-sm text-muted-foreground">Script (hex)</label>
                      <Input
                        value={output.script || ''}
                        onChange={(e) => updateOutput(index, { script: e.target.value })}
                        placeholder="Enter script in hex format"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={addOutput} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Output
            </Button>
            <Button onClick={addOpReturn} variant="outline" size="sm">
              <FileCode className="h-4 w-4 mr-2" />
              Add OP_RETURN
            </Button>
            <Button onClick={addScript} variant="outline" size="sm">
              <FileCode className="h-4 w-4 mr-2" />
              Add Script
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

