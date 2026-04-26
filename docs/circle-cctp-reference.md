# Circle CCTP V2 Reference

> Extracted from Circle developer docs. Last updated: 2026-03-05

---

## Domain Identifiers

| Domain | Blockchain      |
|--------|-----------------|
| 0      | Ethereum        |
| 1      | Avalanche       |
| 2      | OP Mainnet      |
| 3      | Arbitrum        |
| 5      | Solana          |
| 6      | Base            |
| 7      | Polygon PoS     |
| 10     | Unichain        |
| 11     | Linea           |
| 12     | Codex           |
| 13     | Sonic           |
| **14** | **World Chain** |
| 15     | Monad           |
| 16     | Sei             |
| 17     | BNB Smart Chain |
| 18     | XDC             |
| 19     | HyperEVM        |
| 21     | Ink             |
| 22     | Plume           |
| 25     | Starknet        |
| 26     | Arc Testnet     |
| 28     | EDGE Testnet    |
| 30     | Morph Hoodi Testnet |

> **Note:** If a mainnet is listed, its official testnet is also supported.
> Domain IDs are the same on testnet and mainnet.

---

## Transfer Types

### Fast Transfer (`minFinalityThreshold` ≤ 1000)
Attestation after 1 block confirmation. **This is what we should use.**

| Source Chain  | Block confirmations | Average time |
|---------------|---------------------|--------------|
| World Chain   | 1                   | ~8 seconds   |
| Base          | 1                   | ~8 seconds   |
| Ethereum      | 2                   | ~20 seconds  |
| Arbitrum      | 1                   | ~8 seconds   |
| OP Mainnet    | 1                   | ~8 seconds   |

### Standard Transfer (`minFinalityThreshold` ≥ 2000)
Waits for hard finality (L1 batch + ~65 ETH blocks for OP Stack chains).

| Source Chain  | Block confirmations | Average time    |
|---------------|---------------------|-----------------|
| World Chain   | ~65 ETH blocks      | **~15-19 min**  |
| Base          | ~65 ETH blocks      | ~15-19 min      |
| Ethereum      | ~65                 | ~15-19 min      |
| Linea         | 1                   | 6-32 hours!     |

> **Key insight for this project:** World Chain is an OP Stack L2. Standard Transfer
> requires the batch to be posted to Ethereum L1 AND ~65 ETH L1 blocks to finalize.
> On testnet this can take longer than 40 min (explaining the attestation timeout).
> **Use Fast Transfer** to get ~8s attestation instead.

---

## Mainnet Contract Addresses (CCTP V2)

### TokenMessengerV2 — same address on all chains
`0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`

### MessageTransmitterV2 — same address on all chains
`0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`

### TokenMinterV2 — same address on all chains
`0xfd78EE919681417d192449715b2594ab58f5D002`

---

## Testnet Contract Addresses (CCTP V2)

From Circle docs / confirmed in project code:

| Contract              | Address                                      |
|-----------------------|----------------------------------------------|
| TokenMessengerV2      | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2  | `0xe737e5cebeeba77efe34d4aa090756590b1ce275` |

> These appear to be **shared across testnet chains** (same pattern as mainnet).
> The project's `chains.ts` uses `0xe737e5cebeeba77efe34d4aa090756590b1ce275` for
> World Chain Sepolia MessageTransmitter — this matches the Circle docs example.

---

## Attestation API

### Endpoint
```
GET https://iris-api-sandbox.circle.com/v2/messages/{sourceDomain}?transactionHash={txHash}
```
Production: `https://iris-api.circle.com`

### Response Status Values

| Response                   | Meaning                              | Action                          |
|----------------------------|--------------------------------------|---------------------------------|
| HTTP 404                   | Attestation not yet observed         | Continue polling (expected)     |
| `{ "messages": [] }`       | Transaction found, not processed yet | Continue polling                |
| `{ "status": "pending" }`  | Awaiting block confirmations         | Continue polling                |
| `{ "status": "complete" }` | Attestation ready                    | Proceed to mint                 |

> **Note:** 404 is **normal and expected** while waiting — do not treat as failure.

### Rate Limits
- 35 requests/second max
- Exceeding limit → blocked for **5 minutes** (HTTP 429)
- Recommended poll interval: **5 seconds** (current project uses 15s — safe but slow)

---

## Issues Found in Project vs. Docs

### 1. ⚠️ Standard Transfer causing 40-min timeout
**Problem:** The burn transaction likely uses `minFinalityThreshold >= 2000` (Standard Transfer).
World Chain Standard Transfer requires L1 finality (~65 ETH blocks = 15-19 min mainnet, potentially
longer on testnet). This is why attestation never completed in 40 min on testnet.

**Fix:** When calling `depositForBurn` on World Chain, set `minFinalityThreshold` to a value ≤ 1000
to use Fast Transfer (~8 seconds).

### 2. ⚠️ HTTP 404 not handled in polling loop
**Problem:** `cctp-monitor.ts` polling loop calls `resp.json()` without checking `resp.status`.
If Iris returns 404 (normal while waiting), `resp.json()` may fail or return unexpected data.

**Fix:** Check `resp.status === 404` and continue polling (don't treat as error).

### 3. ⚠️ HTTP 429 not handled
**Problem:** If rate-limited (429), the code silently retries without backing off.

**Fix:** On 429, wait 5 minutes before retrying.

### 4. Minor: Poll interval (15s) is 3x the recommended (5s)
Not a bug, just slower UX than necessary. Safe to reduce to 5s.

---

## Correct Polling Implementation (from Circle docs)

```typescript
const resp = await fetch(pollUrl);

// 404 = not yet observed (normal)
if (resp.status === 404) {
  console.log('Attestation not yet available (404), waiting...');
  await sleep(POLL_INTERVAL_MS);
  continue;
}

// 429 = rate limited
if (resp.status === 429) {
  console.log('Rate limited, waiting 5 minutes...');
  await sleep(300_000);
  continue;
}

const data = await resp.json();
const msg = data.messages?.[0];

if (msg?.status === 'complete' && msg.attestation && msg.attestation !== 'PENDING') {
  attestationHex = msg.attestation;
  break;
}
```

---

## Minting is Idempotent (Safe to Retry)

Each attestation contains a unique nonce usable only once. Submitting the same
attestation multiple times → only the first succeeds. Subsequent calls revert
with "nonce already used" but no double-spend occurs.

**Implication:** The `/api/bridge/retry/:intentId` endpoint is safe to call even
if a previous relay attempt partially succeeded.

---

## References
- Supported chains & domains: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
- Finality times: https://developers.circle.com/cctp/concepts/finality-and-block-confirmations
- Attestation troubleshooting: https://developers.circle.com/cctp/howtos/resolve-stuck-attestation
- Retry failed mint: https://developers.circle.com/cctp/howtos/retry-failed-mint
- Contract addresses: https://developers.circle.com/cctp/references/contract-addresses
- API reference: https://developers.circle.com/api-reference/cctp/all/get-messages-v2
