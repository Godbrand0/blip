# Blip — AI-Powered Cross-Chain USDC Bridge

**Blip** lets you bridge USDC across chains by typing a sentence. No RPCs, no token approvals, no confusing UIs — just intent. Built on World Chain and powered by Circle CCTP V2.

> *"Bridge 10 USDC to Base"* → done in seconds.

**Live demo:** https://blip-frontend-two.vercel.app

**World App miniapp:** https://world.org/mini-app?app_id=app_a354163a8c7050bc98a0221fd3e64b68&path=/

---

## The Problem

Cross-chain bridging is broken for everyday users:
- Too many manual steps (approve → bridge → wait → claim)
- Wrapped tokens create fragmented liquidity and security risk
- No native mobile experience inside wallet apps

Blip solves all three.

---

## How It Works

```
User types intent
      ↓
AI parses chain, amount, recipient
      ↓
USDC burns on World Chain via CCTP V2
      ↓
Circle Iris API attests the burn off-chain
      ↓
Backend relayer calls receiveMessage on Base
      ↓
Native USDC minted to your wallet on Base
```

No wrapped tokens. No liquidity pools. True native USDC the whole way.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, Wagmi, RainbowKit, World MiniKit |
| AI Interface | Google Gemini — parses natural language bridge intents |
| Bridge Protocol | Circle CCTP V2 (burn-and-mint, Fast Transfer) |
| Relayer | Node.js + Express — polls Circle Iris API, calls `receiveMessage` |
| Smart Contracts | Foundry (Solidity) — BlipTransactionRecorder |
| Database | MongoDB Atlas |
| Infra | Vercel (frontend), Render (backend) |

---

## World Chain Integration

World Chain Sepolia is Blip's **source chain**. All bridge intents originate here, and the on-chain history record (`BlipTransactionRecorder`) lives on World Chain.

When users open Blip inside the **World App**, the MiniKit SDK is detected automatically. The wallet connection uses a native SIWE (Sign-In with Ethereum) sheet — no external browser, no QR code. After authenticating, MiniKit's wallet signs bridge transactions directly.

---

## AI-Assisted Bridging

The **ChainBridge AI Assistant** is the user-facing interface. Instead of navigating bridge UIs, users describe what they want:

- *"Bridge 10 USDC to Base"*
- *"Send 50 USDC to 0xabc... on Base Sepolia"*

The AI (Gemini) parses the intent and extracts:
- Source chain + destination chain
- Token and amount
- Recipient address

It then presents a confirmation card before executing. Under the hood it batches the `approve` and `depositForBurn` calls so users sign once.

---

## CCTP V2: Why Native USDC Matters

Most bridges lock tokens and mint wrapped equivalents. CCTP is different:

1. **Burn** — USDC is destroyed on World Chain via `TokenMessenger.depositForBurn`
2. **Attest** — Circle's Iris API signs proof of the burn
3. **Mint** — Native USDC is minted on Base via `MessageTransmitter.receiveMessage`

The result: you receive real USDC on the destination chain, not a wrapped version. No liquidity fragmentation, no peg risk.

Blip uses **Fast Transfer** mode (`minFinalityThreshold ≤ 1000`) for ~8 second attestations instead of the 15–20 minute standard transfer window.

---

## Deployed Contracts

### World Chain Sepolia (Chain ID: 4801)

| Contract | Address |
|---|---|
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

### Backend

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev            # starts on :4000
```

Key env vars:
```
RELAYER_PRIVATE_KEY=          # wallet that pays gas for receiveMessage on Base
WORLD_CHAIN_RPC=              # World Chain Sepolia RPC URL
BASE_RPC=                     # Base Sepolia RPC URL
DATABASE_URL=                 # MongoDB Atlas connection string
CCTP_ATTESTATION_URL=https://iris-api-sandbox.circle.com
TRANSACTION_RECORDER_ADDRESS=0xfd3957cdcf616f805024491f666a01bd9d835cc4
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev               # starts on :3000
```

---

## Repository Structure

```
blip/
├── frontend/          # Next.js app (UI, MiniKit wallet auth, AI chat)
├── backend/           # Node.js relayer, CCTP monitor, intent routes
├── contract/          # Foundry smart contracts
└── docs/              # Reference documentation
```

---

## Roadmap

1. **Multi-chain expansion** — Add Arbitrum, Optimism, Polygon, Avalanche via CCTP
2. **Mainnet deployment** — After smart contract audit
3. **Complex DeFi intents** — *"Bridge to Arbitrum and deposit into Aave"*
4. **Decentralized relayer** — Open relayer network so no single operator controls finalization
