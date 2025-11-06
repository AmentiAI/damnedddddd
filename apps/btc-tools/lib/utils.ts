import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateString(str: string | undefined | null, maxLength: number): string {
  if (!str || typeof str !== 'string') {
    return ''
  }
  if (str.length <= maxLength) {
    return str
  } else {
    const leftHalf = str.slice(0, Math.ceil((maxLength - 3) / 2))
    const rightHalf = str.slice(-Math.floor((maxLength - 3) / 2))
    return leftHalf + '...' + rightHalf
  }
}

export function formatSats(sats: number): string {
  return sats.toLocaleString()
}

export function formatAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

