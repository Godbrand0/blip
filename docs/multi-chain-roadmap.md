# Blip — Multi-Chain Expansion Plan

## Current State

Blip currently supports two chains on testnet:

| Chain | Chain ID | Role | CCTP Domain |
|-------|----------|------|-------------|
| World Chain Sepolia | 4801 | Source (primary) | 14 |
| Base Sepolia | 84532 | Destination | 6 |

The architecture is already chain-agnostic by design. The `CHAIN_CONFIGS` map in [frontend/src/config/contracts.ts](../frontend/src/config/contracts.ts) and the `CHAINS` object in [backend/src/config/chains.ts](../backend/src/config/chains.ts) are keyed by chain ID — adding a new chain is a config addition, not a code rewrite.

The same Circle CCTP V2 contracts (`TokenMessengerV2`, `MessageTransmitterV2`) are deployed at **identical addresses** across all supported chains. A new destination chain requires:

1. Adding its chain ID + domain + USDC address to config
2. Adding a public RPC client in the frontend
3. Adding a backend signer + poller instance for the destination
4. Deploying `BlipTransactionRecorder` on the new chain (if recording is needed there)

---

## Why Multi-Chain Matters

World Chain users hold USDC but the DeFi ecosystem lives on Arbitrum, OP Mainnet, Ethereum, and Polygon. Locking Blip to a single destination (Base) caps the addressable market. Each new destination chain added:

- Opens Blip to that chain's native liquidity and DeFi protocols
- Expands the B2B market (protocols on Arbitrum, OP Mainnet, etc. can use Blip's relay API)
- Increases daily transaction volume without changing the fee model
- Makes Blip the default bridge for World Chain users regardless of where they're going

---

## CCTP V2 Supported Chains (Ready to Add)

All chains below are live on CCTP V2. Adding them to Blip requires config changes only — no new contract deployments on Circle's side.

### Mainnet Chains

| Chain | Chain ID | CCTP Domain | USDC Address | Priority |
|-------|----------|-------------|--------------|----------|
| Ethereum Mainnet | 1 | 0 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Medium |
| Base | 8453 | 6 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | **High** |
| OP Mainnet | 10 | 2 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | **High** |
| Arbitrum One | 42161 | 3 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | **High** |
| Polygon PoS | 137 | 7 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Medium |
| Avalanche C-Chain | 43114 | 1 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Low |
| Sonic | 146 | 13 | TBD | Low |
| Linea | 59144 | 11 | `0x176211869cA2b568f2A7D4EE941E073a821EE1ff` | Low |

### Testnet Chains (for dev/staging)

| Chain | Chain ID | CCTP Domain | Notes |
|-------|----------|-------------|-------|
| Ethereum Sepolia | 11155111 | 0 | — |
| OP Sepolia | 11155420 | 2 | — |
| Arbitrum Sepolia | 421614 | 3 | — |
| Base Sepolia | 84532 | 6 | **Already live** |
| Polygon Amoy | 80002 | 7 | — |

---

## Phased Rollout

### Phase 1 — Mainnet Launch (Next milestone)

**Goal**: Mirror the current testnet setup on mainnet.

Chains:
- World Chain (mainnet, Chain ID: 480, Domain: 14) — source
- Base (mainnet, Chain ID: 8453, Domain: 6) — destination

**What's needed:**
- Audit + deploy `HumanRegistry` and `BlipTransactionRecorder` on World Chain mainnet
- Update `CHAIN_CONFIGS` with mainnet contract addresses
- Update backend `CHAINS` with mainnet RPCs and contracts
- Point Circle Iris API calls to production endpoint (`https://iris-api.circle.com` not sandbox)
- Switch World ID verification to production RP credentials

**Contracts to deploy (World Chain mainnet):**
- `HumanRegistry.sol` — gates bridge access to verified humans
- `BlipTransactionRecorder.sol` — on-chain transaction history

**No new Circle contracts needed** — CCTP V2 is already live on World Chain mainnet and Base mainnet.

---

### Phase 2 — OP Mainnet + Arbitrum (1–3 months post-mainnet)

**Goal**: Add the two largest L2 ecosystems as destinations. This opens up Uniswap, Aave, GMX, Velodrome, and hundreds of other protocols to World Chain USDC holders.

**What's needed per chain (frontend):**

In [frontend/src/config/contracts.ts](../frontend/src/config/contracts.ts), add entries to `CHAIN_CONFIGS`:

```ts
// OP Mainnet
10: {
  usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  domain: 2,
  name: "OP Mainnet",
  explorer: "https://optimistic.etherscan.io"
},
// Arbitrum One
42161: {
  usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  domain: 3,
  name: "Arbitrum One",
  explorer: "https://arbiscan.io"
},
```

**What's needed per chain (backend):**

In [backend/src/config/chains.ts](../backend/src/config/chains.ts), add entries to `CHAINS`. Each destination chain needs:
- A public RPC endpoint
- A funded relayer wallet (for `receiveMessage` gas)
- A polling instance in `cctp-monitor.ts`

The monitor already handles dynamic destination dispatch — extending it to multiple destinations requires a `destinationDomain → chainConfig` map and spawning one poller per active intent.

**Estimated effort**: 2–3 days per chain (config + testing). No architectural changes required.

---

### Phase 3 — Bi-Directional Multi-Chain (3–6 months post-mainnet)

**Goal**: Users on Base, Arbitrum, or OP Mainnet can bridge USDC *to* World Chain, not just from it. This is critical for onboarding new users into the World ecosystem.

The frontend already supports direction flipping (`sourceChainId` / `destChainId` are separate state). The constraint is that `HumanRegistry` lives on World Chain — verification must still be checked on-chain there.

**Design decision**: When the source chain is not World Chain, verification proof is submitted on World Chain (via a backend call), then the burn is executed on the user's source chain. The user only needs to sign two transactions: approve + burn. Backend handles the cross-chain verification lookup.

**Chains to support as sources (Phase 3):**
- Base → World Chain
- OP Mainnet → World Chain
- Arbitrum → World Chain

---

### Phase 4 — Full Mesh (6–12 months post-mainnet)

**Goal**: Any CCTP V2 chain ↔ any CCTP V2 chain, with World ID verification as the shared identity layer.

At full mesh, Blip becomes the USDC bridge for the entire Circle-supported ecosystem, gated by human identity. Ethereum ↔ Arbitrum, OP Mainnet ↔ Polygon, Base ↔ Avalanche — any pair.

**Architectural change needed**: The current backend spawns one relayer wallet per destination. At 8+ chains, this becomes unwieldy. Two options:

1. **Chainlink CRE** (already partially built in [blip-cre/bridge/main.ts](../blip-cre/bridge/main.ts)) — decentralized workflow execution, removes the need for Blip to run relayer wallets at all. Operators run the relay; Blip coordinates. Best long-term option.

2. **Relayer pool** — backend manages a pool of funded wallets, dynamically assigns them to pending intents. Simpler short-term but still centralized.

The CRE path is the right call for Phase 4. It removes counterparty risk, makes the relay trustless, and positions Blip as infrastructure rather than a custodial service.

---

## What Needs to Change in Code (Summary)

### Frontend

File: [frontend/src/config/contracts.ts](../frontend/src/config/contracts.ts)
- Add new chain entries to `CHAIN_CONFIGS` (chain ID, USDC address, domain, name, explorer)

File: [frontend/app/bridge/page.tsx](../frontend/app/bridge/page.tsx)
- Add `createPublicClient` instances for each new chain
- Update the `sourcePublicClient` selector to handle new chain IDs
- Add chain options to the source/destination dropdowns

### Backend

File: [backend/src/config/chains.ts](../backend/src/config/chains.ts)
- Add new chain entries to `CHAINS` with RPC, contract addresses, and domain

File: [backend/src/services/cctp-monitor.ts](../backend/src/services/cctp-monitor.ts)
- Update destination dispatch to route by `destinationDomain` dynamically
- Instantiate one wallet client per destination chain from the `CHAINS` config

### Infrastructure
- Fund relayer wallets on each new destination chain with native gas token
- Add RPC endpoints for new chains to environment variables
- Update Iris API polling to handle new domain IDs in status responses

---

## Prioritization Logic

**Phase 1 (Mainnet)** is a prerequisite for everything — testnet has no real volume or revenue.

**Phase 2 (Arbitrum + OP Mainnet)** is highest ROI after mainnet:
- Arbitrum and OP Mainnet have the deepest DeFi liquidity
- Most World Chain users wanting to "do something" with USDC will want Arbitrum (GMX, Aave) or OP Mainnet (Velodrome, Synthetix)
- Both are OP Stack like World Chain, so engineering and tooling knowledge transfers directly

**Phase 3 (Bi-directional)** unlocks World Chain onboarding — important for user growth into the ecosystem.

**Phase 4 (Full mesh via CRE)** is the long-term moat — decentralized relay makes Blip infrastructure, not a service, and removes the single point of failure in the current backend.

---

## Chain Addition Checklist

For each new chain added to production, run through this checklist:

- [ ] Add chain to `CHAIN_CONFIGS` (frontend) with correct CCTP domain ID
- [ ] Add chain to `CHAINS` (backend) with RPC URL and contract addresses
- [ ] Verify USDC contract address on-chain (never assume from docs alone)
- [ ] Verify `TokenMessengerV2` address matches `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- [ ] Fund relayer wallet on new chain with native gas token
- [ ] Test a full round-trip burn → attestation → mint on testnet equivalent
- [ ] Confirm `minFinalityThreshold = 1000` works for Fast Transfer on new chain
- [ ] Add chain's RPC to environment variable config and CI secrets
- [ ] Update Iris API polling — confirm domain ID returns attestations correctly
- [ ] Update UI chain selector with chain name, logo, and explorer link
- [ ] Monitor first 10 mainnet transactions manually before declaring stable
