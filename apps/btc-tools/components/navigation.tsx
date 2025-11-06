'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Home, 
  Zap, 
  RefreshCw, 
  Send, 
  Handshake, 
  CheckCircle, 
  Wrench, 
  Flame, 
  FileText,
  Bug
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/debug', label: 'Debug Station', icon: Bug },
  { href: '/speed-up', label: 'Speed Up', icon: Zap },
  { href: '/recover-padding', label: 'Recover Padding', icon: RefreshCw },
  { href: '/utxo-recovery', label: 'UTXO Recovery', icon: RefreshCw },
  { href: '/transfer-inscriptions', label: 'Transfer', icon: Send },
  { href: '/create-offer', label: 'Create Offer', icon: Handshake },
  { href: '/accept-offer', label: 'Accept Offer', icon: CheckCircle },
  { href: '/tx-builder', label: 'TX Builder', icon: Wrench },
  { href: '/burn-runes', label: 'Burn Runes', icon: Flame },
  { href: '/burn-inscriptions', label: 'Burn Inscriptions', icon: Flame },
  { href: '/op-return', label: 'OP_RETURN', icon: FileText },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-card h-screen sticky top-0 overflow-y-auto">
      <div className="p-4">
        <div className="mb-6 pb-4 border-b">
          <h2 className="text-xl font-bold">SigNull BTC Tools</h2>
        </div>
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-md text-base font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

