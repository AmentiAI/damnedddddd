'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatSats, truncateString } from '@/lib/utils'
import { RefreshCw, CheckCircle, AlertCircle, Clock, Copy, Check, Filter, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { FormattedUTXO } from '@omnisat/lasereyes-core'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createDebugRules, getMatchingRules, getRuleSeverityColor, type DebugRuleConfig, DEFAULT_RULE_CONFIG } from '@/lib/debug-rules'

export default function DebugStationPage() {
  const { paymentAddress, connected, address, network, client } = useLaserEyes()
  const [utxos, setUtxos] = useState<FormattedUTXO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  const [ruleConfig, setRuleConfig] = useState<DebugRuleConfig>(DEFAULT_RULE_CONFIG)
  const [showRulesPanel, setShowRulesPanel] = useState(true)
  
  // Safely create debug rules
  const debugRules = useMemo(() => {
    try {
      return createDebugRules(ruleConfig)
    } catch (err) {
      console.error('Error creating debug rules:', err)
      return []
    }
  }, [ruleConfig])

  const fetchUTXOs = useCallback(async () => {
    if (!paymentAddress || !client) {
      setUtxos([])
      setError('Payment address or client not available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const startTime = Date.now()
      // Get formatted UTXOs from both addresses:
      // - paymentAddress: for spending UTXOs
      // - address: for assets (inscriptions/runes)
      const addressesToFetch = [paymentAddress]
      if (address && address !== paymentAddress) {
        addressesToFetch.push(address)
      }
      
      const formatted = await client.dataSourceManager.getFormattedUTXOs(addressesToFetch)
      const fetchTime = Date.now() - startTime
      
      setUtxos(formatted)
      setLastFetch(new Date())
      
      console.log(`✅ Fetched ${formatted.length} UTXOs from ${addressesToFetch.length} address(es) in ${fetchTime}ms`)
      console.log('Addresses:', addressesToFetch)
      console.log('UTXOs:', formatted)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch UTXOs')
      console.error('❌ Error fetching UTXOs:', err)
      toast.error(`Failed to fetch UTXOs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [paymentAddress, address, client])

  useEffect(() => {
    if (connected && paymentAddress && client) {
      fetchUTXOs()
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchUTXOs, 30000)
      return () => clearInterval(interval)
    }
  }, [connected, paymentAddress, address, client, fetchUTXOs])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const getConfirmationStatus = (utxo: FormattedUTXO) => {
    if (utxo.confirmations === undefined) {
      return { status: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' }
    }
    if (utxo.confirmations === 0) {
      return { status: 'unconfirmed', label: 'Unconfirmed', icon: AlertCircle, color: 'text-orange-500' }
    }
    if (utxo.confirmations < 6) {
      return { status: 'confirming', label: `${utxo.confirmations} confirmations`, icon: Clock, color: 'text-yellow-500' }
    }
    return { status: 'confirmed', label: `${utxo.confirmations} confirmations`, icon: CheckCircle, color: 'text-green-500' }
  }

  // Separate UTXOs by address
  const paymentUTXOs = utxos.filter(utxo => utxo.address === paymentAddress)
  const ordinalsUTXOs = utxos.filter(utxo => utxo.address === address && address !== paymentAddress)
  
  // Calculate stats for payment address
  const paymentBalance = paymentUTXOs.reduce((sum, utxo) => sum + utxo.btcValue, 0)
  const paymentCardinal = paymentUTXOs.filter(utxo => !utxo.hasInscriptions && !utxo.hasRunes && !utxo.hasAlkanes)
  const paymentAssets = paymentUTXOs.filter(utxo => utxo.hasInscriptions || utxo.hasRunes || utxo.hasAlkanes)
  
  // Calculate stats for ordinals address
  const ordinalsBalance = ordinalsUTXOs.reduce((sum, utxo) => sum + utxo.btcValue, 0)
  const ordinalsCardinal = ordinalsUTXOs.filter(utxo => !utxo.hasInscriptions && !utxo.hasRunes && !utxo.hasAlkanes)
  const ordinalsAssets = ordinalsUTXOs.filter(utxo => utxo.hasInscriptions || utxo.hasRunes || utxo.hasAlkanes)
  
  // Total stats
  const totalBalance = paymentBalance + ordinalsBalance
  const totalUTXOs = utxos.length

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔍 Debug Station</h1>
        <p className="text-muted-foreground">
          Real-time UTXO monitoring and confirmation tracking for your payment address
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view UTXO debug information
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Address Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Wallet Addresses</CardTitle>
              <CardDescription>
                Payment address (for spending) and Ordinals address (for assets)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Payment Address <span className="text-xs">(for spending UTXOs)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm bg-muted p-2 rounded">
                      {paymentAddress || 'Not available'}
                    </code>
                    {paymentAddress && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(paymentAddress)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                {address && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Ordinals Address <span className="text-xs">(for assets: inscriptions/runes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm bg-muted p-2 rounded">
                        {address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(address)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">Network</div>
                    <div className="text-lg font-semibold">{network || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="text-lg font-semibold text-green-500">Connected</div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-sm text-muted-foreground mb-1">UTXO Fetch Strategy</div>
                  <div className="text-sm">
                    Fetching UTXOs from both addresses to show:
                    <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                      <li>Payment address: Spending UTXOs (cardinal sats)</li>
                      <li>Ordinals address: Asset UTXOs (inscriptions, runes, alkanes)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debug Rules Configuration */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Debug Rules
                  </CardTitle>
                  <CardDescription>
                    Configure rules to identify and filter UTXOs
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowRulesPanel(!showRulesPanel)}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {showRulesPanel ? 'Hide' : 'Show'} Rules
                </Button>
              </div>
            </CardHeader>
            {showRulesPanel && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Min Sats</label>
                    <input
                      type="number"
                      value={ruleConfig.minSats}
                      onChange={(e) => setRuleConfig({ ...ruleConfig, minSats: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Max Sats</label>
                    <input
                      type="number"
                      value={ruleConfig.maxSats === Infinity ? '' : ruleConfig.maxSats}
                      onChange={(e) => setRuleConfig({ ...ruleConfig, maxSats: e.target.value ? parseInt(e.target.value) : Infinity })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="∞"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Min Confirmations</label>
                    <input
                      type="number"
                      value={ruleConfig.minConfirmations}
                      onChange={(e) => setRuleConfig({ ...ruleConfig, minConfirmations: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Dust Threshold</label>
                    <input
                      type="number"
                      value={ruleConfig.dustThreshold}
                      onChange={(e) => setRuleConfig({ ...ruleConfig, dustThreshold: parseInt(e.target.value) || 546 })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="546"
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Active Rules ({debugRules.filter(r => r.enabled).length})</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {debugRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-2 p-2 rounded border ${getRuleSeverityColor(rule.severity)}`}
                      >
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            setRuleConfig({
                              ...ruleConfig,
                              enabledRules: {
                                ...ruleConfig.enabledRules,
                                [rule.id]: e.target.checked,
                              },
                            })
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium">{rule.name}</div>
                          <div className="text-xs opacity-75 truncate">{rule.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* UTXO Fetch Status */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>UTXO Fetch Status</CardTitle>
                  <CardDescription>
                    Real-time status of UTXO fetching operations
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchUTXOs}
                  disabled={loading || !paymentAddress}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fetch Status</span>
                  <div className="flex items-center gap-2">
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-blue-500 font-medium">Fetching...</span>
                      </>
                    ) : error ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-500 font-medium">Error</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-500 font-medium">Ready</span>
                      </>
                    )}
                  </div>
                </div>
                {lastFetch && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Fetch</span>
                    <span className="text-sm font-mono">
                      {lastFetch.toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                    {error}
                  </div>
                )}
                <div className="pt-2 border-t space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Payment Address</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">UTXOs</div>
                        <div className="text-lg font-semibold">{paymentUTXOs.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Balance</div>
                        <div className="text-lg font-semibold">{formatSats(paymentBalance)} sats</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cardinal</div>
                        <div className="text-lg font-semibold">{paymentCardinal.length}</div>
                      </div>
                    </div>
                  </div>
                  {address && address !== paymentAddress && (
                    <div>
                      <div className="text-sm font-medium mb-2 text-muted-foreground">Ordinals Address</div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">UTXOs</div>
                          <div className="text-lg font-semibold">{ordinalsUTXOs.length}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Balance</div>
                          <div className="text-lg font-semibold">{formatSats(ordinalsBalance)} sats</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Assets</div>
                          <div className="text-lg font-semibold">{ordinalsAssets.length}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Total</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total UTXOs</div>
                        <div className="text-lg font-semibold">{totalUTXOs}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Balance</div>
                        <div className="text-lg font-semibold">{formatSats(totalBalance)} sats</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* UTXO List */}
          <Card>
            <CardHeader>
              <CardTitle>UTXO Details</CardTitle>
              <CardDescription>
                UTXOs separated by address with confirmation status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && utxos.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Fetching UTXOs...</p>
                </div>
              ) : utxos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No UTXOs found for any address
                </div>
              ) : (
                <Tabs defaultValue="payment" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="payment">
                      Payment Address ({paymentUTXOs.length})
                    </TabsTrigger>
                    {address && address !== paymentAddress && (
                      <TabsTrigger value="ordinals">
                        Ordinals Address ({ordinalsUTXOs.length})
                      </TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="payment" className="mt-4">
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Total UTXOs</div>
                          <div className="font-semibold">{paymentUTXOs.length}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Balance</div>
                          <div className="font-semibold">{formatSats(paymentBalance)} sats</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Cardinal</div>
                          <div className="font-semibold">{paymentCardinal.length}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Assets</div>
                          <div className="font-semibold">{paymentAssets.length}</div>
                        </div>
                      </div>
                      {paymentAddress && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground">Address:</div>
                          <code className="text-xs font-mono">{paymentAddress}</code>
                        </div>
                      )}
                    </div>
                    {paymentUTXOs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No UTXOs found for payment address
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {paymentUTXOs.map((utxo) => {
                          const confirmation = getConfirmationStatus(utxo)
                          const StatusIcon = confirmation.icon
                          const matchingRules = getMatchingRules(utxo, debugRules)
                          
                          return (
                            <div
                              key={`${utxo.txHash}-${utxo.txOutputIndex}`}
                              className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                                matchingRules.some(r => r.severity === 'error') ? 'border-red-500/50 bg-red-500/5' :
                                matchingRules.some(r => r.severity === 'warning') ? 'border-yellow-500/50 bg-yellow-500/5' :
                                matchingRules.some(r => r.severity === 'success') ? 'border-green-500/50 bg-green-500/5' :
                                matchingRules.some(r => r.severity === 'info') ? 'border-blue-500/50 bg-blue-500/5' :
                                ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <StatusIcon className={`h-4 w-4 ${confirmation.color}`} />
                                    <span className={`text-sm font-medium ${confirmation.color}`}>
                                      {confirmation.label}
                                    </span>
                                    {utxo.hasInscriptions && (
                                      <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
                                        Inscriptions
                                      </span>
                                    )}
                                    {utxo.hasRunes && (
                                      <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                                        Runes
                                      </span>
                                    )}
                                    {utxo.hasAlkanes && (
                                      <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                                        Alkanes
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    {utxo.address && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Address:</span>
                                        <code className="font-mono text-xs">
                                          {truncateString(String(utxo.address), 16)}
                                        </code>
                                        <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
                                          Payment
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">TXID:</span>
                                      <code className="font-mono text-xs">
                                        {truncateString(String(utxo.txHash || ''), 16)}
                                      </code>
                                      {utxo.txHash && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2"
                                          onClick={() => copyToClipboard(String(utxo.txHash))}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Output Index:</span>
                                      <code className="font-mono">{utxo.txOutputIndex}</code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Value:</span>
                                      <span className="font-semibold">{formatSats(utxo.btcValue)} sats</span>
                                    </div>
                                    {utxo.confirmations !== undefined && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Confirmations:</span>
                                        <span className="font-semibold">{utxo.confirmations}</span>
                                      </div>
                                    )}
                                    {utxo.inscriptions && utxo.inscriptions.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-muted-foreground">Inscriptions:</span>
                                        {utxo.inscriptions.map((inscription, idx) => (
                                          <code
                                            key={idx}
                                            className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded"
                                          >
                                            {truncateString(String(inscription || ''), 12)}
                                          </code>
                                        ))}
                                      </div>
                                    )}
                                    {utxo.runes && utxo.runes.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-muted-foreground">Runes:</span>
                                        {utxo.runes.map((rune, idx) => (
                                          <code
                                            key={idx}
                                            className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded"
                                          >
                                            {truncateString(String(rune.runeId), 12)}
                                            {rune.amount ? ` ×${rune.amount}` : ''}
                                          </code>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {matchingRules.length > 0 && (
                                    <div className="mt-3 pt-3 border-t">
                                      <div className="text-xs text-muted-foreground mb-2">Matching Rules:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {matchingRules.map((rule) => (
                                          <span
                                            key={rule.id}
                                            className={`text-xs px-2 py-0.5 rounded border ${getRuleSeverityColor(rule.severity)}`}
                                            title={rule.description}
                                          >
                                            {rule.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>
                  
                  {address && address !== paymentAddress && (
                    <TabsContent value="ordinals" className="mt-4">
                      <div className="mb-4 p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Total UTXOs</div>
                            <div className="font-semibold">{ordinalsUTXOs.length}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Balance</div>
                            <div className="font-semibold">{formatSats(ordinalsBalance)} sats</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Cardinal</div>
                            <div className="font-semibold">{ordinalsCardinal.length}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Assets</div>
                            <div className="font-semibold">{ordinalsAssets.length}</div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground">Address:</div>
                          <code className="text-xs font-mono">{address}</code>
                        </div>
                      </div>
                      {ordinalsUTXOs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No UTXOs found for ordinals address
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                          {ordinalsUTXOs.map((utxo) => {
                            const confirmation = getConfirmationStatus(utxo)
                            const StatusIcon = confirmation.icon
                            const matchingRules = getMatchingRules(utxo, debugRules)
                            
                            return (
                              <div
                                key={`${utxo.txHash}-${utxo.txOutputIndex}`}
                                className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                                  matchingRules.some(r => r.severity === 'error') ? 'border-red-500/50 bg-red-500/5' :
                                  matchingRules.some(r => r.severity === 'warning') ? 'border-yellow-500/50 bg-yellow-500/5' :
                                  matchingRules.some(r => r.severity === 'success') ? 'border-green-500/50 bg-green-500/5' :
                                  matchingRules.some(r => r.severity === 'info') ? 'border-blue-500/50 bg-blue-500/5' :
                                  ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <StatusIcon className={`h-4 w-4 ${confirmation.color}`} />
                                      <span className={`text-sm font-medium ${confirmation.color}`}>
                                        {confirmation.label}
                                      </span>
                                      {utxo.hasInscriptions && (
                                        <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
                                          Inscriptions
                                        </span>
                                      )}
                                      {utxo.hasRunes && (
                                        <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                                          Runes
                                        </span>
                                      )}
                                      {utxo.hasAlkanes && (
                                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                                          Alkanes
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      {utxo.address && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">Address:</span>
                                          <code className="font-mono text-xs">
                                            {truncateString(String(utxo.address), 16)}
                                          </code>
                                          <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                                            Ordinals
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">TXID:</span>
                                        <code className="font-mono text-xs">
                                          {truncateString(String(utxo.txHash || ''), 16)}
                                        </code>
                                        {utxo.txHash && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2"
                                            onClick={() => copyToClipboard(String(utxo.txHash))}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Output Index:</span>
                                        <code className="font-mono">{utxo.txOutputIndex}</code>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Value:</span>
                                        <span className="font-semibold">{formatSats(utxo.btcValue)} sats</span>
                                      </div>
                                      {utxo.confirmations !== undefined && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">Confirmations:</span>
                                          <span className="font-semibold">{utxo.confirmations}</span>
                                        </div>
                                      )}
                                      {utxo.inscriptions && utxo.inscriptions.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-muted-foreground">Inscriptions:</span>
                                          {utxo.inscriptions.map((inscription, idx) => (
                                            <code
                                              key={idx}
                                              className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded"
                                            >
                                              {truncateString(String(inscription || ''), 12)}
                                            </code>
                                          ))}
                                        </div>
                                      )}
                                      {utxo.runes && utxo.runes.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-muted-foreground">Runes:</span>
                                          {utxo.runes.map((rune, idx) => (
                                            <code
                                              key={idx}
                                              className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded"
                                            >
                                              {truncateString(String(rune.runeId), 12)}
                                              {rune.amount ? ` ×${rune.amount}` : ''}
                                            </code>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {matchingRules.length > 0 && (
                                      <div className="mt-3 pt-3 border-t">
                                        <div className="text-xs text-muted-foreground mb-2">Matching Rules:</div>
                                        <div className="flex flex-wrap gap-1">
                                          {matchingRules.map((rule) => (
                                            <span
                                              key={rule.id}
                                              className={`text-xs px-2 py-0.5 rounded border ${getRuleSeverityColor(rule.severity)}`}
                                              title={rule.description}
                                            >
                                              {rule.name}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

