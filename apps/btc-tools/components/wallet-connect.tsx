'use client'

import {
  useLaserEyes,
  UNISAT,
  XVERSE,
  LEATHER,
  MAGIC_EDEN,
  OKX,
  PHANTOM,
  OYL,
  ORANGE,
  WIZZ,
  OP_NET,
  SPARROW,
  TOKEO,
  KEPLR,
  WalletIcon,
  type ProviderType,
} from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wallet, ChevronDown } from 'lucide-react'
import { useState } from 'react'

type WalletOption = {
  name: string
  provider: ProviderType
  hasProvider: boolean
}

export function WalletConnectButton() {
  const {
    connected,
    address,
    disconnect,
    connect,
    isConnecting,
    hasUnisat,
    hasXverse,
    hasLeather,
    hasMagicEden,
    hasOkx,
    hasPhantom,
    hasOyl,
    hasOrange,
    hasWizz,
    hasOpNet,
    hasSparrow,
    hasTokeo,
    hasKeplr,
  } = useLaserEyes()

  const [isConnectingState, setIsConnectingState] = useState(false)
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null)

  const walletOptions: WalletOption[] = [
    { name: 'UniSat', provider: UNISAT, hasProvider: hasUnisat },
    { name: 'Xverse', provider: XVERSE, hasProvider: hasXverse },
    { name: 'Leather', provider: LEATHER, hasProvider: hasLeather },
    { name: 'Magic Eden', provider: MAGIC_EDEN, hasProvider: hasMagicEden },
    { name: 'OKX', provider: OKX, hasProvider: hasOkx },
    { name: 'Phantom', provider: PHANTOM, hasProvider: hasPhantom },
    { name: 'Oyl', provider: OYL, hasProvider: hasOyl },
    { name: 'Orange', provider: ORANGE, hasProvider: hasOrange },
    { name: 'Wizz', provider: WIZZ, hasProvider: hasWizz },
    { name: 'OP_NET', provider: OP_NET, hasProvider: hasOpNet },
    { name: 'Sparrow', provider: SPARROW, hasProvider: hasSparrow },
    { name: 'Tokeo', provider: TOKEO, hasProvider: hasTokeo },
    { name: 'Keplr', provider: KEPLR, hasProvider: hasKeplr },
  ]

  const availableWallets = walletOptions.filter((w) => w.hasProvider)
  const unavailableWallets = walletOptions.filter((w) => !w.hasProvider)

  const handleConnect = async (wallet: WalletOption) => {
    if (isConnecting || isConnectingState) return
    setIsConnectingState(true)
    setConnectingWallet(wallet.name)
    try {
      await connect(wallet.provider)
    } catch (error) {
      console.error(`Failed to connect ${wallet.name}:`, error)
    } finally {
      setIsConnectingState(false)
      setConnectingWallet(null)
    }
  }

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {address?.slice(0, 8)}...{address?.slice(-6)}
        </span>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isConnecting || isConnectingState}>
          <Wallet className="h-4 w-4 mr-2" />
          {isConnecting || isConnectingState ? 'Connecting...' : 'Connect Wallet'}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {availableWallets.length > 0 && (
          <>
            {availableWallets.map((wallet) => (
              <DropdownMenuItem
                key={wallet.provider}
                onClick={() => handleConnect(wallet)}
                disabled={isConnecting || isConnectingState}
                className="flex items-center gap-2 cursor-pointer"
              >
                <WalletIcon walletName={wallet.provider} size={20} />
                <span>{wallet.name}</span>
                {connectingWallet === wallet.name && (
                  <span className="ml-auto text-xs text-muted-foreground">Connecting...</span>
                )}
              </DropdownMenuItem>
            ))}
            {unavailableWallets.length > 0 && <div className="h-px bg-border my-1" />}
          </>
        )}
        {unavailableWallets.map((wallet) => (
          <DropdownMenuItem
            key={wallet.provider}
            disabled
            className="flex items-center gap-2 opacity-50 cursor-not-allowed"
          >
            <WalletIcon walletName={wallet.provider} size={20} />
            <span>{wallet.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">Not installed</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

