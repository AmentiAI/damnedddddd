# Sandshrew Ord API Integration

This document describes how the BTC Tools application integrates with Sandshrew's ord (inscriptions/runes) endpoints.

## Overview

Sandshrew hosts a cluster of ord instances running in server mode. The API uses a consistent JSON-RPC scheme where method names map to REST endpoints:

- Method name format: `ord_<path>:<components>`
- Parameters are appended as additional path components
- Example: `ord_inscriptions:block` with params `["780286"]` → `GET /inscriptions/block/780286`

## Available Methods

### Inscriptions

#### `ord_inscription` - Get Inscription by ID or Number
```typescript
const inscription = await getInscription(client, '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0')
// or by number
const inscription = await getInscription(client, '802285')
```

#### `ord_inscriptions` - Get Inscriptions by Page Index
```typescript
const result = await getInscriptionsByPage(client, '802285')
// Returns: { ids: string[], more: boolean, page_index: number }
```

#### `ord_inscriptions:block` - Get Inscriptions by Block Height
```typescript
const block = await getInscriptionsByBlock(client, 780236)
// Returns: { hash, target, best_height, height, inscriptions: string[] }
```

#### `ord_block` - Get Inscriptions by Block Hash
```typescript
const block = await getInscriptionsByBlockHash(client, '000000000000000000063a92390ee25a1f0b41ccaf4e675227acd864dc2eb3dd')
```

#### `ord_output` - Get Ord Output (UTXO with inscription/rune info)
```typescript
const output = await getOrdOutput(client, '22a0d4ad3fafb1eb53823b7655103bb7d6d7b61e9ac572e2f493bbdb8a371a09:0')
// Returns: { value, script_pubkey, address, transaction, sat_ranges, inscriptions, runes }
```

#### `ord_r:children` - Get Child Inscriptions
```typescript
const children = await getInscriptionChildren(client, '60bcf821240064a9c55225c4f01711b0ebbcab39aa3fafeefe4299ab158536fai0', 2)
// Optional page parameter
```

#### `ord_r:sat` - Get Inscriptions by Sat Number
```typescript
const inscriptions = await getInscriptionsBySat(client, '1596764664144241', 0)
// Optional page parameter
```

#### `ord_r:sat::at` - Get Inscription at Sat Index
```typescript
const result = await getInscriptionBySatIndex(client, '1596764664144241', 0)
// Returns: { id: string }
```

#### `ord_content` - Get Inscription Content (Base64)
```typescript
const content = await getInscriptionContent(client, '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0')
// Returns base64 encoded content
```

#### `ord_preview` - Get Inscription Preview HTML
```typescript
const preview = await getInscriptionPreview(client, '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0')
// Returns HTML string
```

### Sats

#### `ord_sat` - Get Sat Information
Supports multiple formats:
- By number: `getSatInfo(client, '1596764664144241')`
- By decimal: `getSatInfo(client, '481824.0')`
- By degree: `getSatInfo(client, "1°0′0″0‴")`
- By name: `getSatInfo(client, 'ahistorical')`
- By percentile: `getSatInfo(client, '80%')`

Returns: `{ number, decimal, degree, name, block, cycle, epoch, period, offset, rarity, percentile, satpoint, timestamp, inscriptions }`

## Utility Functions

### `findInscriptionUTXOsWithPadding`
Finds all inscription UTXOs with excess padding (> 5000 sats) for a given address.

```typescript
const paddingUTXOs = await findInscriptionUTXOsWithPadding(client, address)
// Returns: Array<{ outpoint, inscriptionId, excessSats, outputValue }>
```

### `checkInscriptionPadding`
Checks if a specific UTXO has excess padding.

```typescript
const check = await checkInscriptionPadding(client, 'txid:0')
// Returns: { hasExcessPadding: boolean, excessSats: number, outputValue: number }
```

## Usage in BTC Tools

All utilities are available through the `useSandshrewOrd` hook:

```typescript
import { useSandshrewOrd } from '@/hooks/use-sandshrew-ord'

const { fetchInscription, fetchOrdOutput, findPaddingUTXOs, loading, error } = useSandshrewOrd()

// Fetch inscription
const inscription = await fetchInscription('640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0')

// Find padding UTXOs
const paddingUTXOs = await findPaddingUTXOs(address)
```

## Implementation Details

The utilities use the `SandshrewDataSource.call()` method which:
1. Formats JSON-RPC requests correctly
2. Handles authentication via API key
3. Supports network switching (mainnet/testnet/signet)
4. Returns properly typed responses

All methods follow the pattern:
```typescript
const sandshrew = client.dataSourceManager.getSource('sandshrew')
const response = await sandshrew.call('ord_method', [params])
return response.result
```

## References

- [Ord Server Documentation](https://github.com/ordinals/ord/blob/master/src/subcommand/server.rs)
- Sandshrew API: `https://mainnet.sandshrew.io/v2/<api-key>`
- JSON-RPC 2.0 specification

