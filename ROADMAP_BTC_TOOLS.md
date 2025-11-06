# BTC Tools Site - Development Roadmap

## Overview
Build a comprehensive Bitcoin tools website with advanced transaction management, inscription handling, and transaction building capabilities.

## Project Structure
- **App Location**: `apps/btc-tools`
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS + Shadcn UI
- **Wallet Integration**: LaserEyes (@omnisat/lasereyes)
- **Core Library**: @omnisat/lasereyes-core for transaction building

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Create Next.js App
- [x] Initialize new Next.js app in `apps/btc-tools`
- [ ] Configure TypeScript
- [ ] Set up Tailwind CSS
- [ ] Install Shadcn UI components
- [ ] Configure LaserEyes provider
- [ ] Set up routing structure

### 1.2 Core Dependencies
- [ ] Install `@omnisat/lasereyes` (React package)
- [ ] Install `@omnisat/lasereyes-core` (transaction building)
- [ ] Install `bitcoinjs-lib` for PSBT handling
- [ ] Install `@bitcoinerlab/secp256k1` for signing
- [ ] Set up data source configuration (Sandshrew/Maestro)

### 1.3 Layout & Navigation
- [ ] Create main layout with header
- [ ] Build navigation sidebar/menu
- [ ] Add wallet connection component
- [ ] Set up theme provider (dark/light mode)

---

## Phase 2: Transaction Management Tools

### 2.1 Speed Up Transaction (RBF)
**Location**: `/speed-up`

**Features**:
- Input: Transaction ID (pending tx)
- Fetch transaction details from mempool
- Calculate replacement fee (higher than current)
- Build RBF transaction using same inputs
- Allow fee rate override
- Sign and broadcast replacement transaction

**Implementation**:
1. Query mempool for pending transaction
2. Extract inputs and outputs from original tx
3. Create PSBT with same inputs but higher fee
4. Use `signPsbt` from LaserEyes
5. Broadcast via selected method

**Dependencies**:
- `getTransaction` from data source
- `getRawTransaction` for PSBT reconstruction
- Transaction builder utilities

---

### 2.2 Cancel Transaction (CPFP)
**Location**: `/cancel`

**Features**:
- Input: Transaction ID (pending tx)
- Create child transaction spending one output
- Higher fee rate to incentivize mining both
- Support for spending change output
- Fee rate selection

**Implementation**:
1. Fetch pending transaction
2. Identify spendable outputs (change output)
3. Create child transaction with higher fee
4. Build PSBT spending change output
5. Calculate fee to cover parent transaction
6. Sign and broadcast

**Dependencies**:
- UTXO management
- Fee calculation utilities

---

## Phase 3: Inscriptions Management

### 3.1 Recover Padding Sats
**Location**: `/recover-padding`

**Features**:
- Scan connected wallet for inscription UTXOs
- Filter UTXOs with value > 5,000 sats
- Display list of recoverable UTXOs
- Batch recovery option
- Calculate total recoverable sats
- Fee calculation

**Implementation**:
1. Get all UTXOs from connected address
2. Filter for UTXOs with inscriptions
3. Check `outputValue` > 5000 sats
4. Create transaction sending excess to payment address
5. Preserve inscription in UTXO
6. Send excess sats to change address

**Dependencies**:
- `getFormattedUTXOs` from DataSourceManager
- Inscription UTXO filtering
- Transaction builder with inscription preservation

---

### 3.2 Transfer Inscriptions
**Location**: `/transfer-inscriptions`

**Features**:
- Multi-select inscription picker
- Single or multiple recipient addresses
- Batch transfer support
- Preview before sending
- Fee estimation

**Implementation**:
1. Use `createInscriptionsSendPsbt` from core
2. Support multiple inscription IDs
3. Support array of recipient addresses
4. Build PSBT with proper UTXO handling
5. Sign and broadcast

**Dependencies**:
- `createInscriptionsSendPsbt` from `packages/core/src/lib/inscriptions/psbt.ts`
- Inscription selection UI
- Address input component

---

### 3.3 Create Offer
**Location**: `/create-offer`

**Features**:
- Input: Inscription ID to buy
- Input: Offer price in sats
- Generate PSBT for buying inscription
- Export PSBT for sharing
- Compatible with ord node format

**Implementation**:
1. Fetch inscription details
2. Build PSBT with:
   - Input: Buyer's payment UTXOs
   - Output 1: Seller's address (offer price)
   - Output 2: Inscription UTXO (seller's address)
   - Output 3: Change to buyer
3. Export PSBT in base64 format
4. Provide download option

**Dependencies**:
- PSBT builder utilities
- Inscription info fetching
- Offer PSBT format (ord-compatible)

---

### 3.4 Accept Offer
**Location**: `/accept-offer`

**Features**:
- Import PSBT (base64 or hex)
- Validate offer PSBT
- Display offer details (price, inscription)
- Execute and sign offer
- Broadcast transaction

**Implementation**:
1. Parse imported PSBT
2. Extract offer details from PSBT
3. Validate inscription ownership
4. Sign PSBT with seller's wallet
5. Finalize and broadcast

**Dependencies**:
- PSBT parsing utilities
- `signPsbt` from LaserEyes
- Transaction validation

---

## Phase 4: Transaction Builder

### 4.1 TX Builder Main Component
**Location**: `/tx-builder`

**Features**:
- Multiple input types:
  - Cardinal UTXO picker
  - Inscription UTXO picker
  - Rune UTXO picker
- Output builder:
  - Address and amount inputs
  - OP_RETURN output option
  - Script output option
  - CSV import for bulk outputs
- Change UTXO handling
- Transaction version selection (v2/v3)
- Fee calculation and rate selection
- Broadcast method selection

**Implementation**:
1. Build UTXO selection interface
2. Categorize UTXOs by type (cardinal, inscription, rune)
3. Add/remove inputs dynamically
4. Build output list with validation
5. Calculate fees dynamically
6. Support CSV import for outputs
7. Build PSBT from selected inputs/outputs
8. Support transaction version 3 for TRUC packages

**Key Components**:
- `UTXOPicker` - Select UTXOs by type
- `OutputBuilder` - Add/edit outputs
- `FeeCalculator` - Real-time fee calculation
- `PSBTBuilder` - Assemble transaction

**Dependencies**:
- `getFormattedUTXOs` for UTXO listing
- `bitcoin.Psbt` for transaction building
- Fee estimation utilities

---

## Phase 5: Burn Tools

### 5.1 Burn Runes
**Location**: `/burn-runes`

**Features**:
- Select rune(s) to burn
- Display rune balances
- Input amount to burn
- Optional on-chain message
- Fee calculation

**Implementation**:
1. Get rune balances from UTXOs
2. Build transaction with:
   - Input: Rune UTXO
   - Output: OP_RETURN with burn data
3. Use rune burn protocol (ord standard)
4. Sign and broadcast

**Dependencies**:
- Rune balance utilities
- OP_RETURN builder
- Rune burn protocol implementation

---

### 5.2 Burn Inscriptions
**Location**: `/burn-inscriptions`

**Features**:
- Single inscription burn with message
- Multiple inscription batch burn
- Optional on-chain message
- Preview before burn

**Implementation**:
1. Select inscription(s) to burn
2. Optional: Add message text
3. Build transaction:
   - Input: Inscription UTXO(s)
   - Output: OP_RETURN with burn data + message
4. Sign and broadcast

**Dependencies**:
- Inscription selection
- OP_RETURN builder with message encoding
- Multi-UTXO transaction builder

---

## Phase 6: OP_RETURN Tool

### 6.1 OP_RETURN Creator
**Location**: `/op-return`

**Features**:
- Text input for arbitrary data
- Data encoding options (UTF-8, hex)
- Fee rate selection
- Transaction cost calculator
- Broadcast method selection
- Download signed transaction option

**Implementation**:
1. Encode user input to bytes
2. Build PSBT with:
   - Input: User's UTXOs
   - Output: OP_RETURN with encoded data
   - Change output
3. Calculate transaction size and fee
4. Sign and broadcast (or download)

**Dependencies**:
- OP_RETURN encoding utilities
- Transaction size estimation
- Fee calculation

---

## Phase 7: Shared Components & Utilities

### 7.1 Fee Management
- [ ] Fee rate selector (slow/medium/fast/custom)
- [ ] Real-time fee calculation
- [ ] Fee estimation from mempool.space
- [ ] Custom fee rate input

### 7.2 Broadcast Methods
- [ ] Mempool.space integration
- [ ] MARA Slipstream integration
- [ ] Download signed transaction option
- [ ] Manual broadcast instructions

### 7.3 UTXO Management
- [ ] UTXO list component
- [ ] Filter by type (cardinal/inscription/rune)
- [ ] UTXO details modal
- [ ] UTXO selection interface

### 7.4 Transaction Preview
- [ ] Transaction summary component
- [ ] Input/output visualization
- [ ] Fee breakdown display
- [ ] Transaction size display

---

## Phase 8: UI/UX Polish

### 8.1 Design System
- [ ] Consistent color scheme
- [ ] Typography system
- [ ] Component library integration
- [ ] Responsive design

### 8.2 User Experience
- [ ] Loading states
- [ ] Error handling
- [ ] Success notifications
- [ ] Transaction status tracking
- [ ] Help tooltips

### 8.3 Testing
- [ ] Unit tests for utilities
- [ ] Integration tests for tools
- [ ] E2E tests for critical flows

---

## Technical Implementation Details

### Database Architecture

**All tools are database-driven using Supabase (PostgreSQL)**:

1. **Database Tables**:
   - `transactions` - All transaction records across all tools
   - `inscription_transfers` - Inscription transfer operations
   - `offers` - Buy/sell offers for inscriptions
   - `burns` - Inscription and rune burn records
   - `tx_builders` - Custom transaction builder configurations
   - `op_returns` - OP_RETURN transaction records

2. **Database Features**:
   - Row Level Security (RLS) for data isolation
   - Automatic timestamp updates
   - Optimized indexes for performance
   - JSONB metadata support for flexible data storage

3. **API Routes**:
   - All tools persist data via Next.js API routes
   - Server-side Supabase client for secure operations
   - Client-side hooks for easy data access

### Core Libraries to Use

1. **Transaction Building**:
   - `bitcoinjs-lib` - PSBT creation and manipulation
   - `@omnisat/lasereyes-core` - Wallet integration and UTXO management

2. **Database**:
   - `@supabase/supabase-js` - Supabase client for PostgreSQL
   - Server-side and client-side database access

3. **Data Sources**:
   - Sandshrew API for UTXO and inscription data
   - Mempool.space for fee rates and transaction data
   - Maestro API (optional fallback)

4. **Signing**:
   - LaserEyes `signPsbt` method
   - Support for all LaserEyes wallets

### Key Utilities Needed

1. **PSBT Builder** (`lib/psbt-builder.ts`):
   - Build PSBT from inputs/outputs
   - Handle different UTXO types
   - Calculate fees
   - Support transaction versions

2. **Fee Calculator** (`lib/fee-calculator.ts`):
   - Estimate transaction size
   - Calculate fees based on rate
   - Get recommended fees from mempool

3. **UTXO Utilities** (`lib/utxo-utils.ts`):
   - Filter UTXOs by type
   - Get inscription UTXOs
   - Get rune UTXOs
   - Get cardinal UTXOs

4. **RBF Utilities** (`lib/rbf.ts`):
   - Fetch pending transaction
   - Build replacement transaction
   - Calculate replacement fee

5. **CPFP Utilities** (`lib/cpfp.ts`):
   - Identify spendable outputs
   - Build child transaction
   - Calculate child fee

6. **Burn Utilities** (`lib/burn.ts`):
   - Build OP_RETURN outputs
   - Encode burn data
   - Handle message encoding

---

## File Structure

```
apps/btc-tools/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home/dashboard
│   ├── speed-up/
│   │   └── page.tsx            # Speed up transaction tool
│   ├── cancel/
│   │   └── page.tsx            # Cancel transaction tool
│   ├── recover-padding/
│   │   └── page.tsx            # Recover padding sats
│   ├── transfer-inscriptions/
│   │   └── page.tsx            # Transfer inscriptions
│   ├── create-offer/
│   │   └── page.tsx            # Create offer PSBT
│   ├── accept-offer/
│   │   └── page.tsx            # Accept offer PSBT
│   ├── tx-builder/
│   │   └── page.tsx            # Transaction builder
│   ├── burn-runes/
│   │   └── page.tsx            # Burn runes tool
│   ├── burn-inscriptions/
│   │   └── page.tsx            # Burn inscriptions tool
│   └── op-return/
│       └── page.tsx            # OP_RETURN tool
├── components/
│   ├── ui/                     # Shadcn UI components
│   ├── FeeSelector.tsx         # Fee rate selector
│   ├── BroadcastMethod.tsx     # Broadcast method selector
│   ├── UTXOPicker.tsx          # UTXO selection component
│   ├── OutputBuilder.tsx       # Output builder component
│   ├── TransactionPreview.tsx  # Transaction preview
│   └── WalletConnect.tsx        # Wallet connection
├── lib/
│   ├── psbt-builder.ts         # PSBT building utilities
│   ├── fee-calculator.ts       # Fee calculation
│   ├── utxo-utils.ts           # UTXO utilities
│   ├── rbf.ts                  # RBF utilities
│   ├── cpfp.ts                 # CPFP utilities
│   ├── burn.ts                 # Burn utilities
│   └── utils.ts                # General utilities
└── types/
    └── index.ts                # TypeScript types
```

---

## Implementation Priority

### High Priority (MVP)
1. Project setup and infrastructure
2. TX Builder (core functionality)
3. Speed Up Transaction (RBF)
4. Transfer Inscriptions
5. OP_RETURN tool

### Medium Priority
6. Cancel Transaction (CPFP)
7. Recover Padding Sats
8. Burn Inscriptions
9. Burn Runes

### Lower Priority (Advanced)
10. Create Offer
11. Accept Offer
12. Advanced TX Builder features (CSV import, script outputs)

---

## Next Steps

1. **Create app structure** ✅ (Starting now)
2. **Set up basic routing and layout**
3. **Implement TX Builder first** (most complex, will inform other tools)
4. **Add other tools incrementally**
5. **Polish and test**

---

## Notes

- **All tools are database-driven** - Every transaction, PSBT, and operation is persisted to Supabase
- **Transaction History** - Users can view their transaction history across all tools
- **Status Tracking** - All operations track status: pending → signed → broadcasting → confirmed/failed
- **PSBT Storage** - PSBTs are stored in both hex and base64 formats for compatibility
- All tools should support both mainnet and testnet
- Transaction fees should be clearly displayed
- Users should be able to preview transactions before signing
- Error handling should be comprehensive
- All tools should work with LaserEyes wallet integration

## Database Setup

1. Create `.env.local` with Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

2. Run the SQL schema (`supabase/schema.sql`) in your Supabase SQL Editor

3. All tables will be created with RLS policies and indexes

