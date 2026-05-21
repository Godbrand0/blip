# Blip Mainnet Addresses

Reference for when Blip is promoted from testnet to mainnet. All addresses below are production values.

---

## Critical Differences from Testnet

The CCTP V2 contract addresses are **different** on mainnet vs testnet:

| Contract | Testnet | Mainnet |
|---|---|---|
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |

The Iris attestation API also changes:

| | URL |
|---|---|
| Testnet (sandbox) | `https://iris-api-sandbox.circle.com` |
| Mainnet | `https://iris-api.circle.com` |

---

## Supported Chains

### World Chain (Chain ID: 480)

| Key | Value |
|---|---|
| Chain ID | `480` |
| CCTP Domain | `14` |
| RPC | `https://worldchain-mainnet.g.alchemy.com/public` |
| Explorer | `https://worldchain-mainnet.explorer.alchemy.com` |
| USDC | `0x79A02482A880bCe3F13E09da970dC34dB4cD24D1` |
| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |

---

### Base (Chain ID: 8453)

| Key | Value |
|---|---|
| Chain ID | `8453` |
| CCTP Domain | `6` |
| RPC | `https://mainnet.base.org` |
| Explorer | `https://basescan.org` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |

---

### Monad (Chain ID: 143)

| Key | Value |
|---|---|
| Chain ID | `143` |
| CCTP Domain | `15` |
| RPC | `https://rpc.monad.xyz` |
| Explorer | `https://monadvision.com` |
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |

---

### Arc — Not Yet on Mainnet

Arc is currently **testnet-only** (domain 26, chain ID 5042002). Circle has not listed Arc in the mainnet CCTP V2 deployment. Monitor Circle's [contract addresses page](https://developers.circle.com/stablecoins/usdc-contract-addresses) and Arc's announcements for the mainnet launch.

Expected mainnet configuration once live:

| Key | Value |
|---|---|
| Chain ID | TBD |
| CCTP Domain | `26` (likely, confirm at launch) |
| RPC | TBD |
| Explorer | `https://arcscan.app` (assumed) |
| USDC | `0x3600000000000000000000000000000000000000` (confirm at launch — testnet address) |
| TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` (confirm at launch) |
| MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` (confirm at launch) |

---

## Blip Contracts — Require Mainnet Deployment

The following contracts are deployed on **World Chain Sepolia** and must be redeployed to **World Chain mainnet (480)** before going live. Addresses below are testnet only.

| Contract | Testnet Address (World Chain Sepolia 4801) | Mainnet Address |
|---|---|---|
| HumanRegistry | `0x84b1634ec67d309aeb9dc422f001350e467dcbc8` | TBD |
| BlipTransactionRecorder | `0xfd3957cdcf616f805024491f666a01bd9d835cc4` | TBD |

After deploying to mainnet, update:
- `CONTRACTS.TRANSACTION_RECORDER.address` in `backend/src/config/contracts.ts`
- `NEXT_PUBLIC_TRANSACTION_RECORDER_ADDRESS` in frontend env

---

## Mainnet Checklist

- [ ] Deploy `HumanRegistry` to World Chain mainnet (480)
- [ ] Deploy `BlipTransactionRecorder` to World Chain mainnet (480)
- [ ] Update `CCTP_ATTESTATION_URL` → `https://iris-api.circle.com`
- [ ] Update all `tokenMessenger` addresses → `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`
- [ ] Update all `messageTransmitter` addresses → `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`
- [ ] Update `WORLD_CHAIN_RPC` to a private Alchemy/Infura endpoint (not public)
- [ ] Update `BASE_RPC` to a private endpoint
- [ ] Update `WORLD_CHAIN_USDC` → `0x79A02482A880bCe3F13E09da970dC34dB4cD24D1`
- [ ] Update `BASE_SEPOLIA_USDC` / `BASE_USDC` → `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Confirm Arc mainnet availability and fill in TBDs above
- [ ] Fund relayer wallet on all mainnet chains (ETH for gas; USDC for Arc gas)
- [ ] Switch World App MiniKit app ID to production
