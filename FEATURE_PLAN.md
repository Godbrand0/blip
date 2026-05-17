# Blip Feature Implementation Plan

Three features aligned with Circle grant criteria: gasless bridging, Circle Programmable Wallets, and P2P cross-chain payments.

---

## Build Order

```
Phase 1 — P2P Payments          (no new contracts, lowest effort)
Phase 2 — Circle Wallets        (new onboarding path, medium effort)
Phase 3 — Gasless Bridging      (new smart contract, highest effort)
```

P2P goes first because it reuses everything already built. Circle Wallets opens a new user segment. Gasless Bridging is the deepest change and benefits from the infrastructure already in place from phases 1 and 2.

---

## Phase 1: P2P Cross-Chain Payments

### What it does

Users send USDC to another wallet, across chains, just by typing:

- *"Pay 0xabc... 20 USDC"* — same chain, direct ERC20 transfer
- *"Send 50 USDC to 0xabc on Base"* — cross-chain, routes through CCTP
- *"Request 30 USDC from 0xdef"* — generates a payment link

The AI determines whether a direct transfer or a CCTP bridge is needed, then routes accordingly. The user sees one UX — they never think about chains.

### How it differs from bridging-to-self

| Bridging | P2P Payment |
|---|---|
| `mintRecipient` = your own address | `mintRecipient` = someone else's address |
| AI action: `bridge` | AI action: `pay` |
| Self-funded | You pay, they receive |

The CCTP mechanics are identical. The difference is intent parsing and who the recipient is.

---

### 1.1 AI Route changes (`frontend/app/api/ai/route.ts`)

Extend the Gemini schema with a new `action` value and a `note` field:

```ts
// New action values
// 'bridge'  — user bridges to themselves (existing)
// 'pay'     — user sends to someone else, may be cross-chain
// 'request' — user wants to request payment (generates link)
// 'unknown' — cannot parse

// Add to responseSchema properties:
note: {
  type: Type.STRING,
  description: "Optional payment note or memo from the user."
},
```

Update `systemInstruction` to teach the AI the distinction:

```
- If the user says "pay", "send to", "transfer to" + a non-self address, set action to 'pay'.
- If the user says "bridge", "move" with no recipient or recipient is 'self', set action to 'bridge'.
- If the user says "request", "ask for", "invoice", set action to 'request' with recipient = the payer address.
- 'pay' cross-chain: source and destination may differ. Default destination to the chain the recipient is most likely on (ask if unclear).
```

---

### 1.2 ChatInterface changes (`frontend/components/ChatInterface.tsx`)

Add a `handleP2PPayment` function alongside `handleExecuteBridge`:

```ts
const handleP2PPayment = async (data: any) => {
  const { amount, recipient, source, destination, note } = data;
  const sourceChainId  = CHAIN_ID_MAP[source]      || 4801;
  const destChainId    = CHAIN_ID_MAP[destination] || 4801;
  const isCrossChain   = sourceChainId !== destChainId;

  if (isCrossChain) {
    // Reuse handleExecuteBridge — recipient is already set to their address
    return handleExecuteBridge({ ...data, action: 'bridge' });
  }

  // Same-chain: direct ERC20 transfer
  const rawAmount = usdcToRaw(amount);
  const sourceConfig = CHAIN_CONFIGS[sourceChainId];

  if (isMiniKit) {
    const res = await MiniKit.commandsAsync.sendTransaction({
      transaction: [{
        address: sourceConfig.usdc,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient, rawAmount],
      }],
    });
    if (res.finalPayload.status === 'error') throw new Error('Payment cancelled');
    // Show receipt
  } else {
    const txHash = await writeContractAsync({
      address: sourceConfig.usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipient as `0x${string}`, BigInt(rawAmount)],
    });
    // Show receipt with txHash
  }
};
```

In the message handler, route by action:

```ts
if (parsed.action === 'bridge') await handleExecuteBridge(parsed);
if (parsed.action === 'pay')    await handleP2PPayment(parsed);
if (parsed.action === 'request') handlePaymentRequest(parsed); // see below
```

---

### 1.3 Payment Request links

When action is `request`, generate a shareable URL and show it in the chat with three share options based on the user's wallet type.

#### Link generation (`frontend/components/ChatInterface.tsx`)

```ts
const handlePaymentRequest = (data: any) => {
  const params = new URLSearchParams({
    to:     walletAddress!,
    amount: String(data.amount),
    chain:  data.source || 'World Chain',
    note:   data.note || '',
  });
  const link = `${window.location.origin}/pay?${params.toString()}`;

  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `Payment request created for ${data.amount} USDC.`,
    type: 'payment-request',
    data: { link, amount: data.amount, note: data.note, chain: data.source },
  }]);
};
```

#### Share options rendered in the chat card

Three share methods are shown contextually — the UI adapts based on how the user connected:

| Share method | When shown | How it works |
|---|---|---|
| **World App DM** | Always shown inside World App (`isMiniKit === true`) | `MiniKit.commandsAsync.shareDeepLink({ link })` — opens the native World App share sheet |
| **Email** | Always shown as a fallback | `window.location.href = \`mailto:?subject=Payment Request&body=${link}\`` — opens the device mail client with the link pre-filled |
| **Copy link** | Always shown | `navigator.clipboard.writeText(link)` — copies to clipboard with a visual "Copied!" confirmation |

#### Payment request chat card (new message type: `'payment-request'`)

Add a new branch in the message renderer alongside `'intent'` and `'receipt'`:

```tsx
{msg.type === 'payment-request' && (
  <div className="border-2 border-white p-6 space-y-6 bg-black">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Payment Request</span>
    </div>

    <div className="space-y-1">
      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Requesting</p>
      <p className="text-2xl font-black mono text-white">{msg.data.amount} USDC</p>
      {msg.data.note && (
        <p className="text-[10px] text-zinc-400 mono">"{msg.data.note}"</p>
      )}
    </div>

    {/* Link preview */}
    <div className="p-3 border border-zinc-800 bg-zinc-950">
      <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Payment Link</p>
      <p className="text-[10px] mono text-white break-all">{msg.data.link}</p>
    </div>

    {/* Share actions */}
    <div className="space-y-2">
      {/* World App DM — only when inside MiniKit */}
      {isMiniKit && (
        <button
          onClick={() => MiniKit.commandsAsync.shareDeepLink({ link: msg.data.link })}
          className="w-full py-3 border border-white text-white text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          Share via World App
        </button>
      )}

      {/* Email share */}
      <button
        onClick={() => {
          const subject = encodeURIComponent(`Payment Request: ${msg.data.amount} USDC`);
          const body = encodeURIComponent(
            `Hi,\n\nI'm requesting ${msg.data.amount} USDC${msg.data.note ? ` for: ${msg.data.note}` : ''}.\n\nPay me here: ${msg.data.link}`
          );
          window.location.href = `mailto:?subject=${subject}&body=${body}`;
        }}
        className="w-full py-3 border border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-widest hover:border-white hover:text-white transition-colors"
      >
        Share via Email
      </button>

      {/* Copy link */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(msg.data.link);
          // Briefly swap button label to "Copied!" — managed via local state or a ref
        }}
        className="w-full py-3 border border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-widest hover:border-white hover:text-white transition-colors"
      >
        Copy Link
      </button>
    </div>
  </div>
)}
```

#### `/pay` landing page (`frontend/app/pay/page.tsx`)

The payer opens the link, the page reads the URL params, and pre-populates the AI chat with the constructed intent so the payer just confirms:

```ts
// On mount, read params and inject a pre-filled message into the chat:
// `Pay ${amount} USDC to ${to} on ${chain}${note ? ` for: ${note}` : ''}`
// The chat renders an intent card immediately — payer connects wallet and clicks Confirm.
```

The `/pay` page wraps `<ChatInterface>` inside `<AuthGate>` so the payer must connect a wallet before the pre-fill runs. Once connected, the intent card appears automatically.

---

### 1.4 ERC20 ABI addition (`frontend/src/config/contracts.ts`)

Add `transfer` to the existing `ERC20_ABI`:

```ts
{
  name: "transfer",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to",     type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
},
```

---

### 1.5 Backend intent storage

Add `intentType: 'BRIDGE' | 'PAYMENT'` to the `Intent` schema in `backend/src/database/db.ts` so analytics can distinguish bridging from pure payments.

---

### Phase 1 summary

| File | Change |
|---|---|
| `frontend/app/api/ai/route.ts` | Extend schema: `pay`, `request` actions + `note` field |
| `frontend/components/ChatInterface.tsx` | Add `handleP2PPayment`, `handlePaymentRequest`; new `'payment-request'` message type with World App DM / email / copy-link share actions |
| `frontend/src/config/contracts.ts` | Add `transfer` to ERC20_ABI |
| `frontend/app/pay/page.tsx` | New page: reads URL params, wraps ChatInterface + AuthGate, pre-fills intent on mount |
| `backend/src/database/db.ts` | Add `intentType` field to Intent |

**Effort:** 2–3 days

---

---

## Phase 2: Circle Programmable Wallets

### What it does

Users create a self-custodied wallet inside Blip using just an email address — no MetaMask, no seed phrase. Circle handles key management via threshold signing (the user controls their own key share). The wallet is a real EVM address that can hold USDC and sign bridge transactions.

This directly integrates Circle's Wallets product (one of the five named products in the grant criteria) and dramatically expands the addressable user base.

**SDK:** `@circle-fin/w3s-pw-web-sdk` (Circle Web3 Services Programmable Wallets)

---

### 2.1 Circle dashboard setup

1. Create a project at [console.circle.com](https://console.circle.com)
2. Enable **User-Controlled Wallets** under Web3 Services
3. Create a wallet set for World Chain (chain ID 4801) and Base Sepolia (84532)
4. Copy: `APP_ID`, `API_KEY`, `ENTITY_SECRET`

---

### 2.2 Backend: user + wallet creation (`backend/src/routes/circle-wallet.routes.ts`)

New route file handling the Circle API interactions server-side (API key must never reach the client):

```ts
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s';
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
};

// POST /api/circle/init-user
// Creates a Circle user entity and returns the userToken + encryptionKey for the SDK challenge
router.post('/init-user', async (req, res) => {
  const { userId } = req.body; // walletAddress or app-generated UUID

  // 1. Create user
  const userRes = await fetch(`${CIRCLE_BASE}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId }),
  });
  const user = await userRes.json();

  // 2. Get session token for SDK challenge
  const tokenRes = await fetch(`${CIRCLE_BASE}/users/token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId }),
  });
  const { userToken, encryptionKey } = (await tokenRes.json()).data;

  res.json({ userToken, encryptionKey, appId: process.env.CIRCLE_APP_ID });
});

// POST /api/circle/create-wallet
// Triggers wallet initialisation after the user completes the PIN challenge
router.post('/create-wallet', async (req, res) => {
  const { userId } = req.body;

  const walletRes = await fetch(`${CIRCLE_BASE}/user/wallets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idempotencyKey: uuidv4(),
      userId,
      blockchains: ['WLD-ETH-SEPOLIA', 'BASE-ETH-SEPOLIA'],
      accountType: 'SCA',
    }),
  });
  const wallet = (await walletRes.json()).data;

  // Store walletId → userId mapping in MongoDB
  res.json({ challengeId: wallet.challengeId });
});

// GET /api/circle/wallet/:userId
// Returns wallet addresses for a user
router.get('/wallet/:userId', async (req, res) => {
  const walletsRes = await fetch(
    `${CIRCLE_BASE}/wallets?userId=${req.params.userId}`,
    { headers }
  );
  const wallets = (await walletsRes.json()).data?.wallets ?? [];
  res.json({ wallets });
});

export default router;
```

Register in `backend/src/index.ts`:
```ts
import circleWalletRoutes from './routes/circle-wallet.routes';
app.use('/api/circle', circleWalletRoutes);
```

---

### 2.3 Frontend: Circle Wallet onboarding (`frontend/src/components/CircleWalletSetup.tsx`)

```ts
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';

export function CircleWalletSetup({ onComplete }: { onComplete: (address: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail]     = useState('');

  const handleCreate = async () => {
    setLoading(true);
    const userId = `blip_${email.replace(/[^a-z0-9]/gi, '_')}`;

    // 1. Get userToken + encryptionKey from backend
    const initRes  = await fetch('/api/circle/init-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const { userToken, encryptionKey, appId } = await initRes.json();

    // 2. Trigger wallet creation challenge
    const createRes = await fetch('/api/circle/create-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const { challengeId } = await createRes.json();

    // 3. Launch Circle SDK UI (PIN setup)
    const sdk = new W3SSdk();
    sdk.setAppSettings({ appId });
    sdk.setAuthentication({ userToken, encryptionKey });
    sdk.execute(challengeId, async (error, result) => {
      if (error) { setLoading(false); return; }

      // 4. Fetch the created wallet address
      const walletsRes = await fetch(`/api/circle/wallet/${userId}`);
      const { wallets } = await walletsRes.json();
      const worldWallet = wallets.find((w: any) => w.blockchain === 'WLD-ETH-SEPOLIA');
      if (worldWallet) onComplete(worldWallet.address);
      setLoading(false);
    });
  };

  return (
    <div className="space-y-4">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full p-3 bg-zinc-900 border border-zinc-700 text-white text-sm"
      />
      <button
        onClick={handleCreate}
        disabled={loading || !email}
        className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-widest disabled:opacity-50"
      >
        {loading ? 'CREATING WALLET...' : 'Create Wallet with Email'}
      </button>
    </div>
  );
}
```

---

### 2.4 AuthGate integration

Add Circle Wallet as a third connection path in `AuthGate.tsx`, alongside RainbowKit and MiniKit:

```tsx
// In the !isWalletConnected branch, show three options:
// 1. Connect MetaMask / browser wallet  (existing — RainbowKit)
// 2. Open in World App                  (existing — MiniKit)
// 3. Create / restore wallet with email (new — Circle)

const [showCircleSetup, setShowCircleSetup] = useState(false);

{showCircleSetup ? (
  <CircleWalletSetup onComplete={(addr) => {
    setWalletAddress(addr);
    setShowCircleSetup(false);
  }} />
) : (
  <>
    {/* existing connect buttons */}
    <button onClick={() => setShowCircleSetup(true)} className="...">
      Use Email Instead
    </button>
  </>
)}
```

---

### 2.5 Transaction signing with Circle wallets

Circle user-controlled wallets sign transactions through the same SDK challenge flow. When a Circle wallet user initiates a bridge, instead of calling `writeContractAsync` directly, send the transaction via the Circle API:

```ts
// POST /api/circle/send-transaction (backend)
const txRes = await fetch(`${CIRCLE_BASE}/user/transactions/contractExecution`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    idempotencyKey: uuidv4(),
    userId,
    walletId,
    contractAddress: TOKEN_MESSENGER_ADDRESS,
    abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)',
    abiParameters: [amount, destDomain, mintRecipient, usdcAddress, '0x0...0', maxFee, threshold],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  }),
});
// Returns challengeId → execute in SDK UI
```

---

### 2.6 New env vars

```
CIRCLE_API_KEY=          # Circle Web3 Services API key
CIRCLE_APP_ID=           # Circle App ID (public, goes to frontend too)
CIRCLE_ENTITY_SECRET=    # Entity secret for server-side signing
NEXT_PUBLIC_CIRCLE_APP_ID=   # Same APP_ID for frontend SDK
```

---

### Phase 2 summary

| File | Change |
|---|---|
| `backend/src/routes/circle-wallet.routes.ts` | New: user init, wallet creation, wallet fetch, tx submission |
| `backend/src/index.ts` | Register `/api/circle` routes |
| `backend/src/database/db.ts` | Add `circleUserId`, `circleWalletId` to User schema |
| `frontend/src/components/CircleWalletSetup.tsx` | New: email onboarding with Circle SDK |
| `frontend/src/components/AuthGate.tsx` | Add "Use Email" path |
| `frontend/package.json` | Add `@circle-fin/w3s-pw-web-sdk` |

**Effort:** 4–5 days

---

---

## Phase 3: Gasless Bridging via USDC Fee Sponsorship

### What it does

Users bridge USDC without holding any ETH. They sign a single EIP-2612 **permit** off-chain (free, no gas) authorizing the bridge amount. The backend submits the transaction and pays gas in ETH. The USDC fee (0.2 USDC total: 0.1 USDC CCTP fee + 0.1 USDC gas coverage) is deducted from the bridged amount.

This removes the last barrier for USDC-only users — especially relevant for World App users who may not hold ETH.

---

### 3.1 New smart contract: `BlipGaslessRelay.sol`

Deploy on World Chain Sepolia. This contract:
1. Accepts a permit signature from the user
2. Pulls USDC from the user (no prior approval needed)
3. Calls `TokenMessenger.depositForBurn` on behalf of the user

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUSDC {
    function permit(address owner, address spender, uint256 value,
        uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ITokenMessenger {
    function depositForBurn(
        uint256 amount, uint32 destinationDomain, bytes32 mintRecipient,
        address burnToken, bytes32 destinationCaller,
        uint256 maxFee, uint32 minFinalityThreshold
    ) external returns (uint64 nonce);
}

contract BlipGaslessRelay {
    address public immutable USDC;
    address public immutable TOKEN_MESSENGER;
    address public owner;
    address public relayer;                  // backend signing key
    uint256 public constant GAS_FEE = 100_000; // 0.1 USDC gas coverage fee

    event Gaslessbridge(address indexed user, uint256 amount, uint32 destDomain);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address _usdc, address _tokenMessenger, address _relayer) {
        USDC          = _usdc;
        TOKEN_MESSENGER = _tokenMessenger;
        relayer       = _relayer;
        owner         = msg.sender;
    }

    /// @notice Called by the backend relayer with a user-signed permit.
    /// @param user             User's wallet address (permit signer)
    /// @param amount           Amount to bridge (excluding fees)
    /// @param destDomain       CCTP destination domain
    /// @param mintRecipient    Recipient on destination chain (bytes32)
    /// @param maxFee           CCTP V2 maxFee (e.g. 100_000)
    /// @param threshold        minFinalityThreshold (e.g. 1000 for Fast Transfer)
    /// @param deadline         Permit deadline
    /// @param v, r, s          EIP-2612 permit signature components
    function relayBridge(
        address user,
        uint256 amount,
        uint32  destDomain,
        bytes32 mintRecipient,
        uint256 maxFee,
        uint32  threshold,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external onlyRelayer {
        uint256 total = amount + maxFee + GAS_FEE;

        // Pull USDC using permit (no prior approval needed from user)
        IUSDC(USDC).permit(user, address(this), total, deadline, v, r, s);
        IUSDC(USDC).transferFrom(user, address(this), total);

        // GAS_FEE stays in contract (relayer withdraws periodically to cover ETH costs)
        // Approve TokenMessenger for amount + CCTP fee only
        IUSDC(USDC).approve(TOKEN_MESSENGER, amount + maxFee);

        // Burn
        ITokenMessenger(TOKEN_MESSENGER).depositForBurn(
            amount, destDomain, mintRecipient, USDC, bytes32(0), maxFee, threshold
        );

        emit GaslessBridge(user, amount, destDomain);
    }

    /// @notice Owner withdraws accumulated gas fees (in USDC) to fund ETH top-ups.
    function withdrawFees(address to, uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        IUSDC(USDC).approve(address(this), amount);
        IUSDC(USDC).transferFrom(address(this), to, amount);
    }

    function setRelayer(address _relayer) external {
        require(msg.sender == owner, "Not owner");
        relayer = _relayer;
    }
}
```

---

### 3.2 Frontend: collect permit signature (`frontend/components/ChatInterface.tsx` + `frontend/app/bridge/page.tsx`)

Add a `signPermit` helper that asks the user's wallet to sign an EIP-2612 permit:

```ts
import { signTypedData } from 'viem/actions';

async function signPermit(
  walletClient: any,
  owner: string,
  spender: string,   // BlipGaslessRelay address
  value: bigint,
  deadline: bigint,
  usdcAddress: string,
  chainId: number
): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId,
    verifyingContract: usdcAddress as `0x${string}`,
  };
  const types = {
    Permit: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value',   type: 'uint256' },
      { name: 'nonce',   type: 'uint256' },
      { name: 'deadline',type: 'uint256' },
    ],
  };
  // Fetch current nonce from USDC contract
  const nonce = await publicClient.readContract({
    address: usdcAddress as `0x${string}`,
    abi: [{ name: 'nonces', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }] }],
    functionName: 'nonces',
    args: [owner as `0x${string}`],
  });

  const sig = await walletClient.signTypedData({
    account: owner as `0x${string}`,
    domain, types,
    primaryType: 'Permit',
    message: { owner, spender, value, nonce, deadline },
  });

  // Split signature into v, r, s
  const r = sig.slice(0, 66)   as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(sig.slice(130, 132), 16);
  return { v, r, s };
}
```

In the bridge confirmation UI, add a **"Go Gasless"** toggle. When enabled:
1. Call `signPermit()` — wallet pops a signature request (no gas)
2. Send `{ permitSig: { v, r, s, deadline }, txHash: null, gasless: true, ... }` to `POST /api/bridge/relay`

---

### 3.3 Backend: gasless relay path (`backend/src/routes/bridge.routes.ts`)

Detect gasless intents and call `BlipGaslessRelay.relayBridge()` instead of waiting for a user-submitted burn tx:

```ts
router.post('/relay', async (req, res) => {
  const { txHash, gasless, permitSig, user, amount, recipient, sourceChain, destChain } = req.body;

  if (gasless && permitSig) {
    // Gasless path: backend submits the transaction using the permit
    const intentId = `intent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await intents.insertOne({ intentId, user, amount, recipient, status: 'PENDING', ... });

    executeGaslessRelay(intentId, permitSig, user, amount, recipient, sourceChain, destChain)
      .catch(err => console.error('[Gasless] relay failed:', err));

    return res.json({ success: true, intentId, status: 'PENDING' });
  }

  // Existing path (user submitted burn tx, backend relays attestation)
  // ...
});
```

New function `executeGaslessRelay` in `cctp-monitor.ts`:

```ts
export async function executeGaslessRelay(
  intentId: string,
  permitSig: { v: number; r: string; s: string; deadline: string },
  user: string,
  amount: string,
  recipient: string,
  sourceChainName: string,
  destChainName: string
) {
  const sourceChain = CHAINS[sourceChainName];
  const destChain   = CHAINS[destChainName];

  const provider = new ethers.JsonRpcProvider(sourceChain.rpcUrl, ...);
  const signer   = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider);

  const relay = new ethers.Contract(
    process.env.GASLESS_RELAY_ADDRESS!,
    GASLESS_RELAY_ABI,
    signer
  );

  const mintRecipient = `0x${recipient.slice(2).padStart(64, '0')}`;
  const tx = await relay.relayBridge(
    user, amount, destChain.domain,
    mintRecipient,
    '100000',    // maxFee
    1000,        // Fast Transfer
    permitSig.deadline,
    permitSig.v, permitSig.r, permitSig.s
  );
  const receipt = await tx.wait();
  const burnTxHash = receipt.hash;

  // Store burn tx hash and hand off to existing monitorAndRelay
  await intents.updateOne({ intentId }, { $set: { burnTxHash, status: 'PENDING' } });
  return monitorAndRelay(intentId, burnTxHash, sourceChainName, destChainName);
}
```

---

### 3.4 New env vars

```
GASLESS_RELAY_ADDRESS=    # BlipGaslessRelay deployed on World Chain Sepolia
```

---

### 3.5 Deployment steps

```bash
# In contract/
forge create src/BlipGaslessRelay.sol:BlipGaslessRelay \
  --rpc-url $WORLD_CHAIN_RPC \
  --private-key $DEPLOYER_KEY \
  --constructor-args $USDC_ADDRESS $TOKEN_MESSENGER_ADDRESS $RELAYER_ADDRESS

# Verify
forge verify-contract <deployed_address> BlipGaslessRelay \
  --chain-id 4801 \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" $USDC $TM $RELAYER)
```

---

### Phase 3 summary

| File | Change |
|---|---|
| `contract/src/BlipGaslessRelay.sol` | New contract |
| `frontend/components/ChatInterface.tsx` | `signPermit()` helper, gasless toggle |
| `frontend/app/bridge/page.tsx` | Gasless toggle + permit flow |
| `backend/src/routes/bridge.routes.ts` | Detect gasless requests, dispatch to `executeGaslessRelay` |
| `backend/src/services/cctp-monitor.ts` | `executeGaslessRelay()` function |
| `backend/src/config/contracts.ts` | Add `GASLESS_RELAY` ABI + address |

**Effort:** 5–7 days (includes contract testing)

---

---

## Full Dependency Map

```
Phase 1 (P2P)
  └── No dependencies. Ships standalone.

Phase 2 (Circle Wallets)
  └── No hard dependencies on Phase 1.
      P2P payments work naturally with Circle wallets once both are built.

Phase 3 (Gasless)
  └── Needs RELAYER_PRIVATE_KEY already in place (it is).
      Works with all wallet types: RainbowKit, MiniKit, Circle Wallets.
      Circle Wallets users get gasless for free once Phase 3 ships.
```

---

## Circle Grant Alignment

| Feature | Grant criteria hit |
|---|---|
| P2P Payments | Peer-to-peer payments use case |
| Circle Wallets | Direct Circle Wallets product integration |
| Gasless Bridging | USDC utility expansion, removes ETH dependency |
| All three together | Agentic/intent-driven execution + USDC as sole asset |

---

## New env vars summary

```bash
# Phase 2 — Circle Wallets
CIRCLE_API_KEY=
CIRCLE_APP_ID=
CIRCLE_ENTITY_SECRET=
NEXT_PUBLIC_CIRCLE_APP_ID=

# Phase 3 — Gasless Relay
GASLESS_RELAY_ADDRESS=
```
