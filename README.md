# Blip — AI-Powered Cross-Chain Bridging for Verified Humans

**Blip** lets you bridge USDC across chains by typing a sentence. No RPCs, no token approvals, no confusing UIs — just intent. Built on World Chain, workflow by chainlink, secured by World ID 4.0, and powered by Circle CCTP V2.

> *"Bridge 10 USDC to Base"* → done in seconds.

**Live demo:** https://blip-frontend-two.vercel.app
**Worldapp miniapp** https://world.org/mini-app?app_id=app_a354163a8c7050bc98a0221fd3e64b68&path=/

---

## The Problem

Cross-chain bridging is broken for everyday users:
- Too many manual steps (approve → bridge → wait → claim)
- Wrapped tokens create fragmented liquidity and security risk
- Bots and sybil attacks exploit bridge incentives

Blip solves all three.

---

## How It Works

```
User types intent
      ↓
AI parses chain, amount, recipient
      ↓
World ID 4.0 confirms you're human (one-time)
      ↓
USDC burns on World Chain via CCTP
      ↓
Circle attests the burn off-chain
      ↓
Backend / Chainlink CRE relays attestation to Base
      ↓
Native USDC minted to your wallet on Base
```

No wrapped tokens. No liquidity pools. True native USDC the whole way.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, Wagmi, RainbowKit, World MiniKit |
| Identity | World ID 4.0 (RP signatures + IDKit), MiniKit in-app flow |
| Bridge Protocol | Circle CCTP V2 (burn-and-mint) |
| Relayer | Node.js + Express, Chainlink CRE |
| Smart Contracts | Foundry (Solidity) — HumanRegistry, BlipTransactionRecorder |
| Database | MongoDB Atlas |
| Infra | Vercel (frontend), Render (backend) |

---

## World Ecosystem Integration

### World ID 4.0

Blip implements the latest World ID 4.0 protocol for sybil resistance. This version introduced **Relying Party (RP) signatures** — a server-signed token that authenticates every proof request, preventing impersonation attacks.

The verification flow:
1. Backend signs a short-lived request token using a secret `signing_key`
2. Frontend passes that token as `rp_context` when opening the IDKit widget
3. User verifies in World App (orb or device credential)
4. Proof is forwarded to `POST https://developer.world.org/api/v4/verify/{rp_id}`
5. On success, the backend records the nullifier on-chain via `HumanRegistry.sol`

Only verified humans can access the bridge. Bots can't pass the ZK proof, and the RP signature prevents request forgery.

### World MiniKit

When users open Blip inside the **World App**, the MiniKit SDK is detected automatically. The verification flow switches to an in-app native sheet — no external browser, no QR code. After verifying, MiniKit's wallet is used directly for signing bridge transactions.

### World Chain

World Chain Sepolia is Blip's **source chain**. All bridge intents originate here, and on-chain verification records (`HumanRegistry`, `BlipTransactionRecorder`) live on World Chain. This makes World Chain the trust anchor for the entire protocol.

---

## AI-Assisted Bridging

The **ChainBridge AI Assistant** is the user-facing interface. Instead of navigating bridge UIs, users describe what they want:

- *"Bridge 10 USDC to Base"*
- *"Send 50 USDC to 0xabc... on Base Sepolia"*

The AI (Gemini) parses the intent and extracts:
- Source chain + destination chain
- Token and amount
- Recipient address

It then presents a confirmation card with estimated fees before executing. Under the hood it batches the `approve` and `depositForBurn` calls so users sign once.

---

## Chainlink CRE

After USDC burns on World Chain, someone needs to relay the Circle attestation to Base. Blip uses two complementary approaches:

1. **Backend relayer** — Node.js service that polls the Circle Iris API for attestations and broadcasts `receiveMessage` on Base when ready.
2. **Chainlink CRE** (`/blip-cre`) — A decentralized workflow that removes trust from the backend relayer. The CRE reads the `MessageSent` event from World Chain, fetches the attestation from Circle, and autonomously submits it on Base.

The CRE path is trust-minimized: no single operator can censor or delay your bridge.

---

## CCTP V2: Why Native USDC Matters

Most bridges lock tokens and mint wrapped equivalents. CCTP is different:

1. **Burn** — USDC is destroyed on World Chain via `TokenMessenger.depositForBurn`
2. **Attest** — Circle's Iris API signs proof of the burn
3. **Mint** — Native USDC is minted on Base via `MessageTransmitter.receiveMessage`

The result: you receive real USDC on the destination chain, not a wrapped version that has to be swapped back. No liquidity fragmentation, no peg risk.

Blip uses **Fast Transfer** mode (`minFinalityThreshold ≤ 1000`) for ~8 second attestations instead of the 15–20 minute standard transfer window.

---

## Deployed Contracts

### World Chain Sepolia (Chain ID: 4801)

| Contract | Address |
|---|---|
| HumanRegistry | `0x84b1634ec67d309aeb9dc422f001350e467dcbc8` |
| BlipTransactionRecorder | `0xfd3957cdcf616f805024491f666a01bd9d835cc4` |
| USDC | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` |
| CCTP TokenMessenger V2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP MessageTransmitter V2 | `0xe737e5cebeeba77efe34d4aa090756590b1ce275` |

### Base Sepolia (Chain ID: 84532)

| Contract | Address |
|---|---|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| CCTP TokenMessenger V2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP MessageTransmitter V2 | `0xe737e5cebeeba77efe34d4aa090756590b1ce275` |

---

## Running Locally

### Prerequisites
- Node.js 18+, pnpm
- MongoDB Atlas connection string
- World ID Developer Portal app with 4.0 enabled (`app_id`, `rp_id`, `signing_key`)

### Backend

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev            # starts on :4000
```



### Frontend

```bash
cd frontend
pnpm install
pnpm dev               # starts on :3000
```

## Repository Structure

```
blip/
├── frontend/          # Next.js app (UI, MiniKit, IDKit, AI chat)
├── backend/           # Node.js relayer, CCTP monitor, verify routes
├── contract/          # Foundry smart contracts
├── blip-cre/          # Chainlink CRE workflow definition
└── docs/              # Reference documentation
```

---

## Roadmap

1. **Multi-chain expansion** — Add Arbitrum, Optimism, Polygon, Avalanche via CCTP
2. **Mainnet deployment** — After smart contract audit
3. **Complex DeFi intents** — *"Bridge to Arbitrum and deposit into Aave"*
4. **Full CRE transition** — Move 100% of relayer logic into Chainlink CRE for zero-trust execution
