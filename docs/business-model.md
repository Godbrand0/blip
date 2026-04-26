# Blip — Business Model

## What We Are

Blip is a **sybil-resistant stablecoin bridge** for verified humans. Users describe what they want in plain language ("bridge 10 USDC to Base"), Blip verifies they're human via World ID, and natively transfers USDC across chains in ~8 seconds using Circle's CCTP V2. No wrapped tokens. No liquidity pools. No bots.

The three pillars:
- **Identity** — World ID 4.0 ensures every user is a real, unique human
- **Protocol** — Circle CCTP V2 burns USDC on source and mints native USDC on destination (1:1, no peg risk)
- **UX** — Gemini AI parses natural language so users never touch a technical input field

Current state: Live on testnet (World Chain Sepolia → Base Sepolia). Mainnet deployment is the next gate.

---

## The Problem Worth Solving

### Cross-chain UX is broken
Moving money between chains requires users to understand domains, bridge contracts, wrapped tokens, gas on two networks, and manual claim steps. This is friction that kills adoption — especially for mobile-first users in the World App ecosystem.

### Bridges get exploited by bots
Bridge incentive programs, reward airdrops, and referral bonuses are drained by sybil attackers who spin up thousands of wallets. Projects spending $10M in incentives often find 80% captured by bots.

### Wrapped tokens carry hidden risk
Most bridges wrap assets (wETH, wUSDC). This creates: liquidity fragmentation, peg slippage risk, protocol exploits (see Ronin, Wormhole), and user confusion about which "USDC" they hold.

Blip solves all three: frictionless UX, human-only access, and native USDC with no wrapping.

---

## Who Pays

Blip operates at the intersection of two paying audiences:

### 1. End Users (B2C)
Crypto-native users on World Chain who want to move USDC to other chains — for DeFi, payments, or accessing apps on Base, Arbitrum, OP Mainnet. They pay a small per-transaction fee.

**Profile**: World App users, World Chain early adopters, airdrop recipients wanting to move WLD or USDC off World Chain.

### 2. Protocols & Builders (B2B)
Projects that need sybil-resistant cross-chain payment infrastructure. Blip provides:
- **Bridge-as-a-Service**: Embed Blip's bridge widget into their app
- **Verified relay API**: Protocols pay per relay for the guarantee that users are human
- **Human-gated incentive distribution**: Protocols pay Blip to distribute rewards only to verified humans across chains

**Profile**: DeFi protocols running incentive campaigns, games distributing rewards, DAOs running cross-chain grants.

---

## Revenue Model

### Stream 1 — Per-Transaction Bridge Fee (Primary)

Every bridge transaction includes a protocol fee. Circle CCTP V2 already requires a `maxFee` parameter (currently hardcoded to 0.1 USDC). Blip sits between the user and Circle:

```
User pays: 0.15 USDC fee
Circle takes: 0.1 USDC (protocol cost)
Blip keeps: 0.05 USDC margin per transaction
```

This is the simplest path to revenue. The fee is invisible to most users — it's part of the transaction, not a separate approval.

**Volume scenarios:**

| Daily Transactions | Blip Margin/tx | Daily Revenue | Monthly Revenue |
|--------------------|----------------|---------------|-----------------|
| 1,000              | $0.05          | $50           | $1,500          |
| 10,000             | $0.05          | $500          | $15,000         |
| 100,000            | $0.05          | $5,000        | $150,000        |
| 1,000,000          | $0.05          | $50,000       | $1,500,000      |

At 1M daily transactions (realistic for a World App integration at scale), $18M ARR on flat margin alone.

**Fee scaling**: Blip can implement tiered fees — a fixed floor (0.05 USDC) plus a basis-point component (e.g., 3bps on amount). On a $1,000 bridge, 3bps = $0.30. This aligns revenue with user behavior as average transaction sizes grow.

```
Proposed fee formula:  max(0.05 USDC, 0.03% × amount)
```

### Stream 2 — API Access for Protocols (B2B SaaS)

Protocols integrating Blip's relay and verification API pay a monthly subscription or per-call rate.

**Tiers:**

| Tier          | Price/month | Included Relays | Overage  |
|---------------|-------------|-----------------|----------|
| Starter       | $500        | 5,000           | $0.15/tx |
| Growth        | $2,000      | 30,000          | $0.10/tx |
| Scale         | $8,000      | 150,000         | $0.07/tx |
| Enterprise    | Custom      | Unlimited        | SLA + custom pricing |

A protocol running a 30-day incentive campaign sending rewards to 50,000 verified users = $2,000 base + $2,000 overage = $4,000 for the campaign.

### Stream 3 — Human-Gated Incentive Distribution

Protocols want to run airdrops, rewards, and referral programs **guaranteed bot-free**. Blip provides this as a managed service:

- Protocol deposits reward funds into Blip's distribution contract
- Blip verifies each recipient via World ID before releasing funds
- Blip charges 2–3% of total distributed value as a service fee

**Example**: A DeFi protocol distributes $500,000 in rewards. At 2.5% fee, Blip earns $12,500 from a single campaign.

10 campaigns/year at average $300K distribution = ~$75,000/year from this stream alone (small but high-margin, and scales with crypto market activity).

### Stream 4 — White-Label Bridge (Future)

Chains and ecosystems pay to have Blip's UI and infrastructure deployed as their native bridge. Instead of building their own bridge team, they license Blip's stack.

- **Setup fee**: $20,000–$100,000 depending on customization
- **Revenue share**: 20–30% of bridge fees collected on their instance
- **Target**: New EVM L2s, app-chains, and super-app ecosystems (like World Chain) that want a best-in-class bridge with built-in identity verification

---

## Cost Structure

### Operational Costs (Recurring)

| Cost                         | Estimated Monthly | Notes                                         |
|------------------------------|-------------------|-----------------------------------------------|
| Backend infrastructure       | $500–$2,000       | MongoDB Atlas, Node servers, Redis            |
| Circle Iris API calls        | ~$0 (free tier)   | Rate-limited at 35 req/s; throttle at scale   |
| Relayer gas (Base)           | Variable          | Each relay = 1 tx on Base; ~$0.001–$0.01/tx  |
| World ID API calls           | ~$0 (free)        | World developer API is currently free         |
| Gemini AI (intent parsing)   | $50–$500          | Gemini 2.5 Flash; very cheap per token        |
| Engineering (team)           | Largest cost      | See below                                     |

**Relayer gas economics**: At $0.005 avg gas cost per relay on Base, 1M monthly transactions = $5,000 in gas. At $0.05 margin/tx = $50,000 revenue, **gas is 10% of gross margin**. Healthy.

### One-Time / Capex Costs

| Cost                         | Estimated          | Notes                                         |
|------------------------------|--------------------|-----------------------------------------------|
| Smart contract audits        | $20,000–$80,000    | Required before mainnet; HumanRegistry + BlipTransactionRecorder |
| Mainnet deployment           | $500–$2,000        | Gas for deploying contracts on World Chain + Base mainnet |
| Chainlink CRE integration    | Engineering time   | Decentralizes relayer; reduces backend risk   |
| Legal / entity setup         | $5,000–$15,000     | DAO or Delaware C-Corp for token ops if needed |

---

## Unit Economics

**At steady state (100K daily transactions):**

```
Gross revenue:       $5,000/day   ($150K/month)
Gas costs:           $500/day     ($15K/month)
Infra costs:         $2K/month    (fixed)
Gross margin:        ~88%
```

**Break-even** (2-person founding team, $15K/month burn):
- Required: ~$17K/month revenue
- Required transactions: ~340,000/month (~11,300/day)
- Achievable with a single mid-size World App integration

**Scale target** (Series A metrics):
- 1M daily transactions → $1.5M/month gross revenue
- ~$1.3M/month gross margin (88%)
- $15.6M ARR

---

## Go-To-Market

### Phase 1 — World Ecosystem (Now)
World Chain is the launch ecosystem. World has 26M+ verified users and a rapidly growing developer ecosystem. Blip is the natural native bridge because:
1. It uses World ID — the same identity layer World users already have
2. It's built for World App (MiniKit integration)
3. World Chain needs a fast, trusted bridge to Base and Ethereum mainnet

**Distribution**: Get listed in World's app discovery, join World's developer grant program, pitch World foundation for integration.

### Phase 2 — Protocol B2B Sales (6–12 months)
Target DeFi protocols on Base running incentive programs. Pitch: "Run your airdrop through Blip, guarantee 0 bots, bridge rewards directly to verified users."

**Distribution**: Attend ETHDenver, ETHGlobal. Direct outreach to growth teams at Aerodrome, Moonwell, Morpho (all Base-native).

### Phase 3 — Multi-Chain Expansion (12–24 months)
Add Arbitrum, OP Mainnet, Polygon, Avalanche as destinations (all supported by CCTP V2 — same contracts, just new domain IDs). Each new chain expands the addressable market without changing the core architecture.

**Distribution**: Chain foundation grants, co-marketing with L2 teams.

---

## Competitive Landscape

| Competitor         | Mechanism       | World ID | AI UX | Native USDC | Bot Protection |
|--------------------|-----------------|----------|-------|-------------|----------------|
| **Blip**           | CCTP V2         | Yes      | Yes   | Yes         | Yes            |
| Across Protocol    | Liquidity pools | No       | No    | Wrapped     | No             |
| Stargate           | Liquidity pools | No       | No    | Wrapped     | No             |
| Circle CCTP (raw) | Burn-and-mint   | No       | No    | Yes         | No             |
| Wormhole           | Lock-and-mint   | No       | No    | Wrapped     | No             |
| World App bridge   | N/A (not built) | Yes      | No    | TBD         | Yes            |

**Key moat**: No other bridge combines native USDC (no wrapped token risk) + World ID sybil resistance + conversational UX. The identity layer is defensible — replicating World ID's orb network and 26M user base takes years and billions of dollars.

**Secondary moat**: CCTP V2 is Circle's official protocol. Being an early, tight Circle partner positions Blip as the recommended bridge for USDC flows across all CCTP-supported chains.

---

## Risks

| Risk                              | Severity | Mitigation                                                      |
|-----------------------------------|----------|-----------------------------------------------------------------|
| Circle changes CCTP V2 fee structure | Medium | Fee model adjusts; Blip's margin is flexible                  |
| World ID adoption stalls          | High     | Expand to other identity layers (Proof of Humanity, Coinbase Verify) |
| Smart contract exploit            | High     | Audit before mainnet; relayer handles low-value per tx         |
| Centralized relayer is a chokepoint | Medium | Chainlink CRE integration removes this; planned on roadmap    |
| Regulatory (stablecoin / MSB)     | Medium   | CCTP is Circle-operated; Blip is a relay UI, not a custodian  |
| Gas cost spike on Base            | Low      | Base gas is extremely cheap; 10x spike still leaves healthy margin |

---

## The Pitch in One Paragraph

Blip turns cross-chain USDC transfers into a three-tap mobile experience, guaranteed bot-free. We sit on top of Circle's CCTP V2 (the best stablecoin bridge infrastructure in the market) and World ID (26M verified humans), add a conversational AI layer, and charge a small fee on every transaction. The infrastructure is built; testnet is live. We need to get to mainnet, land two or three protocol partnerships for B2B revenue, and capture the World Chain bridging market before someone else does. The bridge market moves $50B/month in volume. Even 0.01% market share at our fee rates is a $60M/year business.
