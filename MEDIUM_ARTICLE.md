# From CCIP to CCTP: Building the Future of Cross-Chain Payments with BLIP

### The evolution of a cross-chain USDC bridge on World Chain and Base.

In the rapidly evolving landscape of decentralized finance, "interoperability" isn't just a buzzword—it's the backbone of usability. Over the last few weeks, our team has been building **BLIP**, a streamlined cross-chain payment layer designed to move value seamlessly across the ecosystem. 

Our journey took us from the robust infrastructure of Chainlink CCIP to the capital-efficient world of Circle’s CCTP, all while maintaining the core principles of the Chainlink Capability Runtime Environment (CRE). Here is how we did it, the hurdles we cleared, and where we stand today.

---

## What is BLIP?

BLIP is more than just a bridge; it’s a localized payment solution. At its core, it allows users to move USDC between **World Chain Sepolia** and **Base Sepolia** with minimal friction. By combining identity verification (World ID) with efficient cross-chain messaging, BLIP ensures that liquidity moves where it’s needed, safely and fast.

## The CCIP Starting Point

We initially began our implementation using **Chainlink CCIP (Cross-Chain Interoperability Protocol)**. CCIP is a powerhouse of security, offering a simplified interface for token transfers and arbitrary data messaging. However, as we neared production-readiness for our specific use case, we encountered a few structural challenges:

1.  **Testnet Availability**: Aligning specific testnet versions across and emerging L2s like World Chain required a more direct approach to USDC liquidity.
2.  **Native USDC Burn/Mint**: For a project focused primarily on USDC, we wanted to leverage Circle’s native protocol to ensure we weren't just wrapping tokens, but moving native liquidity.

## The Pivot to CCTP and Circle

The decision was made to transition to **Circle’s CCTP (Cross-Chain Transfer Protocol)**. CCTP is a permissionless on-chain utility that facilitates USDC transfers between blockchains via a burn-and-mint mechanism.

### How it Works:
1.  **Burn**: A user "burns" USDC on the source chain (World Chain Sepolia) via the `TokenMessenger` contract.
2.  **Attest**: Circle’s Iris API monitors the burn and, after sufficient block confirmations, provides a signed attestation (VAA).
3.  **Mint**: A "relayer" submits this attestation to the destination chain (Base Sepolia), triggering the minting of 1:1 native USDC for the recipient.

## Tying it Back to Chainlink: The "Local CRE"

One might ask: *If you switched to CCTP, where does Chainlink fit in?*

We didn't abandon the Chainlink philosophy; we localized it. In our architecture, the backend acts as a **Local Capability Runtime Environment (CRE)**. 

In the Chainlink ecosystem, the CRE is an environment where off-chain computation and on-chain actions meet. Our backend fulfills this "Relayer" capability:
-   It monitors the source chain for "Intent" events.
-   It performs off-chain verification (checking World ID status) before proceeding.
-   It polls the Circle Iris API for attestations.
-   It programmatically signs and submits the `receiveMessage` transaction on the destination chain.

This "Hybrid Smart Contract" approach gives us the security of on-chain liquidity with the flexibility of off-chain logic.

## The Technical "War Room"

Transitioning protocols is never as easy as swapping an SDK. Our move to CCTP involved navigating a series of "Gotchas" that any bridge developer will recognize:

### 1. The Gas Limit Cap
During deployment, we hit a frustrating wall: `RPC Error: transaction gas limit too high`. 
**The Fix**: World Chain Sepolia, like many L2s, can have strict caps on gas estimation for complex contract calls. We resolved this by implementing a manual gas limit (500k) and switching from "Fast" to "Standard" finality thresholds, allowing the RPC to correctly estimate the work required for a `depositForBurn`.

### 2. Database Constraint Conflicts
Moving from CCIP to CCTP meant a database schema migration. We pivoted from tracking `ccipMessageId` to `burnTxHash` and `messageHash`.
**The Bug**: Ghost indexes in MongoDB. Even after removing the field from the code, unique constraints on legacy fields were causing new transactions to fail. 
**The Resolution**: A full Prisma-to-MongoDB sync (`prisma db push`) to purge the legacy indexes and align the database with the new protocol.

### 3. The 404 Proxy Pivot
In our frontend architecture, we used a proxy API to keep our backend URLs private. A simple path mismatch between `/api/bridge` and `/api/bridge/relay` led to a 404 that stalled the UI.
**The Fix**: A quick restructuring of the Next.js App Router folders to ensure the frontend spoke the same language as the backend.

## The Final Countdown: Pending Attestation

As of today, the system is live and humming. When you trigger a bridge on BLIP:
1.  The UI handles the `approve` and `depositForBurn` calls.
2.  The backend registers your "Intent."
3.  The Relayer enters a polling loop.

On the World Chain Sepolia testnet, this is where patience comes in. Circle’s Iris API (Sandbox) typically requires a few minutes to confirm the burn. Our logs currently show the relayer persistently polling: 
`[CCTP] Attestation pending for 0x2f7a... (attempt 15/180)...`

By increasing our timeout to 15 minutes and adding detailed status logging, we’ve built a bridge that doesn’t just work—it communicates.

## Conclusion

Building BLIP has been a masterclass in protocol migration. Moving from CCIP to CCTP allowed us to get closer to native liquidity, while our "Local CRE" backend kept the logic robust and verifiable. 

Blockchain development isn't always about the fastest sprint; it's about the most resilient architecture. We're excited to see BLIP move more value across the chains, one attestation at a time.

*Stay tuned for our full launch on Mainnet.*
