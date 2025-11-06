'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { formatSats, formatAddress, truncateString } from '@/lib/utils'
import { Check, X, Search } from 'lucide-react'
import type { FormattedUTXO } from '@omnisat/lasereyes-core'

interface UTXOPickerProps {
  type: 'cardinal' | 'inscription' | 'rune'
  selectedUTXOs: FormattedUTXO[]
  onSelect: (utxo: FormattedUTXO) => void
  onDeselect: (utxo: FormattedUTXO) => void
}

export function UTXOPicker({ type, selectedUTXOs, onSelect, onDeselect }: UTXOPickerProps) {
  const { cardinalUTXOs, inscriptionUTXOs, runeUTXOs, loading } = useFormattedUTXOs()
  const [searchTerm, setSearchTerm] = useState('')

  const utxos = {
    cardinal: cardinalUTXOs,
    inscription: inscriptionUTXOs,
    rune: runeUTXOs,
  }[type]

  const filteredUTXOs = utxos.filter((utxo) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      utxo.txHash.toLowerCase().includes(search) ||
      utxo.address.toLowerCase().includes(search) ||
      utxo.inscriptions?.some((insc) => insc.inscriptionId.toLowerCase().includes(search)) ||
      utxo.runes?.some((rune) => rune.runeId.toLowerCase().includes(search))
    )
  })

  const isSelected = (utxo: FormattedUTXO) => {
    return selectedUTXOs.some(
      (selected) =>
        selected.txHash === utxo.txHash && selected.txOutputIndex === utxo.txOutputIndex
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {type === 'cardinal' && 'Cardinal UTXOs'}
            {type === 'inscription' && 'Inscription UTXOs'}
            {type === 'rune' && 'Rune UTXOs'}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {selectedUTXOs.filter((u) => {
              const utxos = {
                cardinal: cardinalUTXOs,
                inscription: inscriptionUTXOs,
                rune: runeUTXOs,
              }[type]
              return utxos.some(
                (utxo) =>
                  utxo.txHash === u.txHash && utxo.txOutputIndex === u.txOutputIndex
              )
            }).length}{' '}
            selected
          </span>
        </CardTitle>
        <CardDescription>
          Select UTXOs to use as inputs for your transaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by TX hash, address, inscription, or rune..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading UTXOs...</div>
        ) : filteredUTXOs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {type} UTXOs found
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUTXOs.map((utxo) => {
              const selected = isSelected(utxo)
              return (
                <div
                  key={`${utxo.txHash}-${utxo.txOutputIndex}`}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-accent border-border'
                  }`}
                  onClick={() => (selected ? onDeselect(utxo) : onSelect(utxo))}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {selected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <div className="h-4 w-4 border-2 rounded border-muted-foreground" />
                        )}
                        <span className="font-mono text-sm">
                          {truncateString(`${utxo.txHash}:${utxo.txOutputIndex}`, 50)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Address: {formatAddress(utxo.address)}</div>
                        <div>Value: {formatSats(utxo.btcValue)} sats</div>
                        {utxo.confirmations !== undefined && (
                          <div>Confirmations: {utxo.confirmations}</div>
                        )}
                        {utxo.hasInscriptions && (
                          <div>
                            Inscriptions: {utxo.inscriptions?.map((i) => truncateString(i.inscriptionId, 12)).join(', ')}
                          </div>
                        )}
                        {utxo.hasRunes && (
                          <div>
                            Runes: {utxo.runes?.map((r) => `${r.runeId} (${r.amount})`).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        selected ? onDeselect(utxo) : onSelect(utxo)
                      }}
                    >
                      {selected ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

