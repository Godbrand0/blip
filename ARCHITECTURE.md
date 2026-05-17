# Blip: System Architecture

Cross-chain USDC bridge from World Chain Sepolia to Base Sepolia using Circle CCTP V2. Users interact via a natural language AI interface or a direct bridge UI, either in-browser or inside World App as a MiniKit miniapp.

---

## High-Level Flow

```
┌─────────────────────────────────────┐
│          User (Browser / World App) │
│  - AI chat or Bridge UI             │
│  - Signs approve + depositForBurn   │
└──────────────┬──────────────────────┘
               │ burn tx hash
               ▼
┌─────────────────────────────────────┐
│         Backend (Node.js)           │
│  POST /api/bridge/relay             │
│  - Stores intent in MongoDB         │
│  - Starts monitorAndRelay()         │
└──────────────┬──────────────────────┘
               │ poll
               ▼
┌─────────────────────────────────────┐
│      Circle Iris API (Sandbox)      │
│  GET /v2/messages/{domain}?tx=...   │
│  Returns attestation once ready     │
└──────────────┬──────────────────────┘
               │ attestation hex
               ▼
┌─────────────────────────────────────┐
│  Base Sepolia MessageTransmitter    │
│  receiveMessage(message, attest)    │
│  → Native USDC minted to recipient  │
└─────────────────────────────────────┘
```

---

## Components

### Frontend (Next.js 16)

- **AI Chat** (`components/ChatInterface.tsx`) — Gemini parses natural language into a bridge intent (chain, amount, recipient). Batches `approve` + `depositForBurn` into a single wallet interaction.
- **Bridge UI** (`app/bridge/page.tsx`) — Form-based bridge with live USDC balance display, chain switching, and relay status via WebSocket.
- **AuthGate** (`src/components/AuthGate.tsx`) — Wallet-only gate. Inside World App: MiniKit SIWE authentication. In browser: RainbowKit `ConnectButton`.
- **AuthContext** (`src/contexts/AuthContext.tsx`) — Provides `walletAddress` and `isMiniKit` to the app. MiniKit detection runs on mount.

### Backend (Node.js + Express)

- **`/api/bridge/relay`** — Receives burn tx hash, stores intent, triggers background relay.
- **`/api/bridge/status/:intentId`** — Returns current relay status.
- **`/api/bridge/retry/:intentId`** — Re-triggers a stuck or failed relay.
- **`cctp-monitor.ts`** — Core relay loop: extracts `MessageSent` bytes from burn tx, polls Iris API for attestation, calls `receiveMessage` on Base Sepolia, updates DB and on-chain recorder.
- **WebSocket** — Pushes `intent-relaying`, `intent-completed`, `intent-failed` events to the frontend in real time.

### Smart Contracts (Foundry, World Chain Sepolia)

- **`BlipTransactionRecorder.sol`** — Records each bridge intent on-chain (`recordTransaction`) and tracks its status (`updateStatus`). The backend relayer calls this after the burn and after finalization.
- **`BlipHistory.sol`** — Historical log of bridge events.

### Circle CCTP V2

| Parameter | Value |
|---|---|
| World Chain Sepolia domain | 14 |
| Base Sepolia domain | 6 |
| Fast Transfer threshold | `minFinalityThreshold ≤ 1000` (~8s attestation) |
| Attestation API | `https://iris-api-sandbox.circle.com` |

---

## Data Flow Detail

1. **Frontend** calls `TokenMessenger.depositForBurn` on World Chain Sepolia with:
   - `burnToken`: USDC (`0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`)
   - `destinationDomain`: 6 (Base Sepolia)
   - `maxFee`: 100,000 (0.1 USDC, required by CCTP V2)
   - `minFinalityThreshold`: 1000 (Fast Transfer)

2. **Backend** receives the `burnTxHash` via `POST /api/bridge/relay`. Inserts an `Intent` document with status `PENDING`.

3. **`monitorAndRelay()`** runs in the background:
   - Parses `MessageSent` log from the burn tx receipt.
   - Polls `GET /v2/messages/14?transactionHash={burnTxHash}` every 5 seconds (up to ~13 minutes).
   - When attestation status is `complete`, calls `receiveMessage(messageBytes, attestationHex)` on Base Sepolia's MessageTransmitter using the `RELAYER_PRIVATE_KEY` wallet.
   - Updates intent status to `RELAYING` → `COMPLETED` (or `FAILED`).
   - Calls `BlipTransactionRecorder.updateStatus()` on World Chain to record final state.

4. **Frontend** receives live updates via WebSocket and falls back to polling `/api/bridge/status/:intentId` every 10 seconds.

---

## Environment Variables

### Backend
| Variable | Description |
|---|---|
| `RELAYER_PRIVATE_KEY` | Wallet key used to pay gas for `receiveMessage` on Base Sepolia |
| `WORLD_CHAIN_RPC` | World Chain Sepolia RPC endpoint |
| `BASE_RPC` | Base Sepolia RPC endpoint |
| `DATABASE_URL` | MongoDB Atlas connection string |
| `CCTP_ATTESTATION_URL` | Circle Iris API base (`https://iris-api-sandbox.circle.com`) |
| `TRANSACTION_RECORDER_ADDRESS` | BlipTransactionRecorder on World Chain Sepolia |
| `WORLD_CHAIN_DOMAIN` | `14` |
| `BASE_SEPOLIA_DOMAIN` | `6` |
