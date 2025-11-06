'use client'

import Link from 'next/link'
import { useLaserEyes } from '@omnisat/lasereyes'
import { 
  Zap, 
  X, 
  Coins, 
  Send, 
  FileText, 
  Hammer, 
  Flame, 
  Code,
  Wrench,
  Wallet
} from 'lucide-react'

const tools = [
  {
    title: 'Speed up Transaction',
    description: 'Replace a pending transaction with higher fees (RBF)',
    href: '/speed-up',
    icon: Zap,
    color: 'text-yellow-500',
  },
  {
    title: 'Cancel Transaction',
    description: 'Cancel a pending transaction (CPFP)',
    href: '/cancel',
    icon: X,
    color: 'text-red-500',
  },
  {
    title: 'Recover Padding Sats',
    description: 'Recover excess sats from inscription UTXOs > 5k sats',
    href: '/recover-padding',
    icon: Coins,
    color: 'text-green-500',
  },
  {
    title: 'Transfer Inscriptions',
    description: 'Transfer multiple inscriptions to one or more addresses',
    href: '/transfer-inscriptions',
    icon: Send,
    color: 'text-blue-500',
  },
  {
    title: 'Create Offer',
    description: 'Create offer PSBT to buy an Inscription',
    href: '/create-offer',
    icon: FileText,
    color: 'text-purple-500',
  },
  {
    title: 'Accept Offer',
    description: 'Accept and execute PSBT to sell an Inscription',
    href: '/accept-offer',
    icon: FileText,
    color: 'text-indigo-500',
  },
  {
    title: 'TX Builder',
    description: 'Build custom transactions with Cardinal, Inscription, and Rune UTXOs',
    href: '/tx-builder',
    icon: Wrench,
    color: 'text-orange-500',
  },
  {
    title: 'Burn Runes',
    description: 'Permanently destroy Runes by spending them to op_return',
    href: '/burn-runes',
    icon: Flame,
    color: 'text-red-600',
  },
  {
    title: 'Burn Inscriptions',
    description: 'Burn inscriptions by spending them to op_return',
    href: '/burn-inscriptions',
    icon: Flame,
    color: 'text-red-700',
  },
  {
    title: 'OP_RETURN',
    description: 'Create a transaction with an OP_RETURN containing arbitrary data',
    href: '/op-return',
    icon: Code,
    color: 'text-gray-500',
  },
]

export default function Home() {
  const { address, connected } = useLaserEyes()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">SigNull BTC Tools</h1>
          <p className="text-muted-foreground">
            Advanced Bitcoin transaction management and inscription tools
          </p>
          {connected && (
            <div className="mt-4 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">
                Connected: {address?.slice(0, 10)}...{address?.slice(-8)}
              </span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`${tool.color} flex-shrink-0`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {tool.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

