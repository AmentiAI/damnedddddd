/**
 * Debug Rules for UTXO Analysis
 * 
 * These rules help identify and filter UTXOs based on various criteria
 * for debugging and analysis purposes.
 */

import type { FormattedUTXO } from '@omnisat/lasereyes-core'

export interface DebugRule {
  id: string
  name: string
  description: string
  enabled: boolean
  check: (utxo: FormattedUTXO) => boolean
  severity: 'info' | 'warning' | 'error' | 'success'
}

export interface DebugRuleConfig {
  minSats: number
  maxSats: number
  minConfirmations: number
  maxConfirmations: number | null
  requireInscriptions: boolean
  requireRunes: boolean
  requireAlkanes: boolean
  excludeInscriptions: boolean
  excludeRunes: boolean
  excludeAlkanes: boolean
  dustThreshold: number
  largeValueThreshold: number
  enabledRules: Record<string, boolean>
}

export const DEFAULT_RULE_CONFIG: DebugRuleConfig = {
  minSats: 0,
  maxSats: Infinity,
  minConfirmations: 0,
  maxConfirmations: null,
  requireInscriptions: false,
  requireRunes: false,
  requireAlkanes: false,
  excludeInscriptions: false,
  excludeRunes: false,
  excludeAlkanes: false,
  dustThreshold: 546,
  largeValueThreshold: 100000,
  enabledRules: {
    dust: true,
    'large-value': true,
    unconfirmed: true,
    'low-confirmations': false,
    'high-confirmations': false,
    'has-inscriptions': true,
    'has-runes': true,
    'has-alkanes': true,
    'cardinal-only': true,
    'sats-range': false,
    'padding-recovery': true,
  },
}

export function createDebugRules(config: DebugRuleConfig): DebugRule[] {
  const rules: DebugRule[] = [
    {
      id: 'dust',
      name: 'Dust UTXO',
      description: `UTXO value is at or below dust threshold (${config.dustThreshold} sats)`,
      enabled: config.enabledRules.dust ?? true,
      check: (utxo) => utxo.btcValue <= config.dustThreshold,
      severity: 'warning',
    },
    {
      id: 'large-value',
      name: 'Large Value UTXO',
      description: `UTXO value exceeds ${config.largeValueThreshold.toLocaleString()} sats`,
      enabled: config.enabledRules['large-value'] ?? true,
      check: (utxo) => utxo.btcValue >= config.largeValueThreshold,
      severity: 'info',
    },
    {
      id: 'unconfirmed',
      name: 'Unconfirmed',
      description: 'UTXO has 0 confirmations',
      enabled: config.enabledRules.unconfirmed ?? true,
      check: (utxo) => utxo.confirmations === 0,
      severity: 'warning',
    },
    {
      id: 'low-confirmations',
      name: 'Low Confirmations',
      description: `UTXO has less than ${config.minConfirmations} confirmations`,
      enabled: (config.enabledRules['low-confirmations'] ?? false) && config.minConfirmations > 0,
      check: (utxo) => 
        utxo.confirmations !== undefined && 
        utxo.confirmations < config.minConfirmations &&
        utxo.confirmations > 0,
      severity: 'warning',
    },
    {
      id: 'high-confirmations',
      name: 'High Confirmations',
      description: `UTXO has more than ${config.maxConfirmations} confirmations`,
      enabled: (config.enabledRules['high-confirmations'] ?? false) && config.maxConfirmations !== null && config.maxConfirmations > 0,
      check: (utxo) => 
        utxo.confirmations !== undefined && 
        config.maxConfirmations !== null &&
        utxo.confirmations > config.maxConfirmations,
      severity: 'info',
    },
    {
      id: 'has-inscriptions',
      name: 'Has Inscriptions',
      description: 'UTXO contains inscriptions',
      enabled: config.enabledRules['has-inscriptions'] ?? true,
      check: (utxo) => utxo.hasInscriptions || (utxo.inscriptions && utxo.inscriptions.length > 0),
      severity: 'success',
    },
    {
      id: 'has-runes',
      name: 'Has Runes',
      description: 'UTXO contains runes',
      enabled: config.enabledRules['has-runes'] ?? true,
      check: (utxo) => utxo.hasRunes || (utxo.runes && utxo.runes.length > 0),
      severity: 'success',
    },
    {
      id: 'has-alkanes',
      name: 'Has Alkanes',
      description: 'UTXO contains alkanes',
      enabled: config.enabledRules['has-alkanes'] ?? true,
      check: (utxo) => utxo.hasAlkanes || (utxo.alkanes && utxo.alkanes.length > 0),
      severity: 'success',
    },
    {
      id: 'cardinal-only',
      name: 'Cardinal Only',
      description: 'UTXO is cardinal (no inscriptions, runes, or alkanes)',
      enabled: config.enabledRules['cardinal-only'] ?? true,
      check: (utxo) => 
        !utxo.hasInscriptions && 
        !utxo.hasRunes && 
        !utxo.hasAlkanes &&
        (!utxo.inscriptions || utxo.inscriptions.length === 0) &&
        (!utxo.runes || utxo.runes.length === 0) &&
        (!utxo.alkanes || utxo.alkanes.length === 0),
      severity: 'info',
    },
    {
      id: 'sats-range',
      name: 'Sats Range',
      description: `UTXO value is between ${config.minSats.toLocaleString()} and ${config.maxSats === Infinity ? '∞' : config.maxSats.toLocaleString()} sats`,
      enabled: (config.enabledRules['sats-range'] ?? false) && (config.minSats > 0 || config.maxSats < Infinity),
      check: (utxo) => utxo.btcValue >= config.minSats && utxo.btcValue <= config.maxSats,
      severity: 'info',
    },
    {
      id: 'padding-recovery',
      name: 'Padding Recovery Candidate',
      description: 'Inscription UTXO with value > 5000 sats (recoverable padding)',
      enabled: config.enabledRules['padding-recovery'] ?? true,
      check: (utxo) => 
        (utxo.hasInscriptions || (utxo.inscriptions && utxo.inscriptions.length > 0)) &&
        utxo.btcValue > 5000,
      severity: 'success',
    },
  ]
  
  return rules
}

export function getMatchingRules(utxo: FormattedUTXO, rules: DebugRule[]): DebugRule[] {
  return rules.filter(rule => rule.enabled && rule.check(utxo))
}

export function getRuleSeverityColor(severity: DebugRule['severity']): string {
  switch (severity) {
    case 'error':
      return 'bg-red-500/20 text-red-500 border-red-500/30'
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    case 'info':
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    case 'success':
      return 'bg-green-500/20 text-green-500 border-green-500/30'
    default:
      return 'bg-gray-500/20 text-gray-500 border-gray-500/30'
  }
}

