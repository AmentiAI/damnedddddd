import './globals.css'

import { ReactNode } from 'react'
import { Toaster } from 'sonner'
import dynamic from 'next/dynamic'
import { ThemeProvider } from 'next-themes'
import { cn } from '@/lib/utils'
import { Navigation } from '@/components/navigation'
import { WalletConnectButton } from '@/components/wallet-connect'

const DynamicLaserEyesProvider = dynamic(
  () => import('@omnisat/lasereyes').then((mod) => mod.LaserEyesProvider),
  { ssr: false }
)

export const metadata = {
  title: 'SigNull BTC Tools',
  description: 'Advanced Bitcoin transaction management and inscription tools',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn('min-h-screen bg-background text-foreground')}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <DynamicLaserEyesProvider
            config={{
              dataSources: {
                sandshrew: {
                  apiKey: process.env.NEXT_PUBLIC_SANDSHREW_API_KEY || '348ae3256c48c15cc99dcb056d2f78df',
                },
              },
            }}
          >
            <div className="flex min-h-screen">
              <Navigation />
              <div className="flex-1 flex flex-col">
                <header className="border-b bg-card">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">SigNull BTC Tools</h1>
                    <WalletConnectButton />
                  </div>
                </header>
                <main className="flex-1">{children}</main>
              </div>
            </div>
            <Toaster />
          </DynamicLaserEyesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
