# BLIP: World ID + Chainlink CRE Hackathon Integration

## 🚀 Project Overview

**BLIP (Blockchain Licensing & Intellectual Property)** is a decentralized platform designed to solve the challenges of AI-driven content creation: **attribution**, **provenance**, and **fair royalty distribution**.

By combining **Chainlink Runtime Environment (CRE)** with **World ID**, BLIP creates a Sybil-resistant ecosystem where human creativity is verified off-chain and rewarded on-chain.

---

## 🛠 Why BLIP Fits the CRE Hackathon

This project leverages CRE as a decentralized referee to handle two complex off-chain validation steps that are impossible or too expensive to perform directly on-chain.

### 1. Trustless Content Governance
BLIP uses CRE to validate content registration. Instead of relying on a centralized server to analyze content similarity, CRE acts as a secure executor:
- **AI Attribution**: CRE triggers off-chain AI models to analyze content for original sources.
- **On-chain Integrity**: Only after CRE "signs off" on the attribution report can the content be registered in the smart contract.

### 2. World ID for Sybil Resistance (Track Priority)
The World ID track focuses on enabling humanness verification on blockchains where it is not natively supported. BLIP accomplishes this using CRE:
- **Off-chain Proof Verification**: The `cre-adapter` verifies World ID ZK-proofs off-chain.
- **Universal Compatibility**: Because CRE handles the verification, BLIP can bring World ID's "Proof of Personhood" to any EVM-compatible chain.
- **Fair Royalties**: Sybil resistance ensures that royalties are distributed to real human creators, preventing bots from gaming the system.

---

## 🔄 Technical Workflow

1.  **Registration**: A creator uploads content and a World ID proof.
2.  **CRE Job Triggered**: The platform initiates a validation job via Chainlink CRE.
3.  **Off-chain Validation**:
    *   **AI Analysis**: The `attribution-agent` scores the content for originality.
    *   **Humanity Check**: The `cre-adapter` verifies the World ID proof against World's developer portal.
4.  **On-chain Settlement**: 
    *   CRE calls `ContentRegistry.validateContent(id, isHuman)`.
    *   If `isHuman` is true, the creator is "blessed" as a unique human.
5.  **Royalty Payout**: When content is licensed (via x402), the `RoyaltyPayout` contract distributes ETH based on the CRE-verified attribution list.

---

## 💡 Key Innovations

- **Decentralized Referee**: Uses CRE to combine AI-heavy workloads with high-assurance identity verification.
- **Bridging Identity**: Demonstrates a "Proof of Humanness" bridge for blockchains where World ID native oracles are absent.
- **Automated IP Economy**: Creates a trustless loop from creation (World ID) to analysis (AI) to payment (Chainlink/EVM).
