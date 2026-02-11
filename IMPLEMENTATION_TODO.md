# BLIP Implementation TODO

Status overview of each layer based on code audit.

---

## Layer 1: World ID (Identity) — NOT IMPLEMENTED

### Frontend — Add IDKitWidget

Install the SDK:

```bash
cd frontend && pnpm i @worldcoin/idkit
```

Add the widget to the content registration page (`frontend/app/page.tsx`):

```tsx
import { IDKitWidget, VerificationLevel, ISuccessResult } from "@worldcoin/idkit";

const handleVerify = async (proof: ISuccessResult) => {
  const res = await fetch("http://localhost:3001/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });
  if (!res.ok) throw new Error("Verification failed.");
};

const onSuccess = () => {
  // Allow user to proceed with content registration
};

<IDKitWidget
  app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID!}
  action={process.env.NEXT_PUBLIC_WORLD_ACTION_ID!}
  onSuccess={onSuccess}
  handleVerify={handleVerify}
  verification_level={VerificationLevel.Orb}
>
  {({ open }) => <button onClick={open}>Verify with World ID</button>}
</IDKitWidget>
```

### Backend — Add verification endpoint

Install the SDK:

```bash
cd backend && npm i @worldcoin/idkit-core
```

Create `backend/src/routes/verify.routes.ts`:

```ts
import { verifyCloudProof, type IVerifyResponse } from "@worldcoin/idkit-core";

router.post("/verify", async (req, res) => {
  const proof = req.body;
  const app_id = process.env.WORLD_APP_ID;
  const action = process.env.WORLD_ACTION_ID;
  const verifyRes = (await verifyCloudProof(proof, app_id, action)) as IVerifyResponse;

  if (verifyRes.success) {
    return res.status(200).json(verifyRes);
  } else {
    return res.status(400).json(verifyRes);
  }
});
```

### CRE Adapter — Replace mock

In `cre-adapter/src/index.ts`, replace the mock `verifyWorldID()` with a real call using `@worldcoin/idkit-core` `verifyCloudProof`.

### Env vars needed

```
NEXT_PUBLIC_WORLD_APP_ID=app_...        # frontend
NEXT_PUBLIC_WORLD_ACTION_ID=...         # frontend
WORLD_APP_ID=app_...                    # backend
WORLD_ACTION_ID=...                     # backend
```

Get these from the World ID Developer Portal (staging environment).

### Checklist

- [ ] Install `@worldcoin/idkit` in frontend
- [ ] Add `IDKitWidget` to registration page
- [ ] Install `@worldcoin/idkit-core` in backend
- [ ] Create `/api/verify` backend route with `verifyCloudProof`
- [ ] Wire route into `app.ts`
- [ ] Replace mock `verifyWorldID()` in `cre-adapter/src/index.ts`
- [ ] Add World ID env vars to all `.env` files
- [ ] Block content registration until World ID proof is verified

---

## Layer 2: AI Attribution Agent — PARTIALLY DONE

Working: Gemini API call, `/analyze` endpoint structure.

### Checklist

- [ ] Replace hardcoded `CONTENT_DATABASE` with query to ContentRegistry (via IPFS/backend)
- [ ] Add Pydantic model for response validation instead of raw `json.loads()`
- [ ] Add explicit failure response (not `confidence: 0.5`) when Gemini fails
- [ ] Add request model validation (use FastAPI's `BaseModel`)
- [ ] Add content hashing before analysis for dedup

---

## Layer 3: Chainlink CRE — INCOMPLETE

Two competing implementations exist. Neither calls the smart contract.



### Option B: Complete the `blip-cre/cre-workflow/` (proper CRE)

In `blip-cre/cre-workflow/src/workflow.ts`:

- [ ] Replace TODO for World ID with HTTP call to World ID API
- [ ] Replace TODO for AI with HTTP call to attribution agent `/analyze`
- [ ] Add on-chain settlement (call `validateContent()` via CRE capabilities)
- [ ] Test with `workflow-test.ts`

### Pick one and remove the other to avoid confusion.

---

## Layer 4: x402 Payment — PARTIALLY DONE

Working: HMAC-SHA256 receipt signing/verification, x402 middleware, token gating on `GET /:id`.

### Checklist

- [ ] Add actual payment collection in `POST /buy/:id` (Coinbase Commerce or direct ETH transfer) before generating receipt
- [ ] Add `RoyaltyPayout` contract to `blockchain.service.ts` and call `distributeRoyalties()` after payment
- [ ] Verify `payer` address matches the connected wallet (don't trust self-reported address)
- [ ] Add `/upload` route to `content.routes.ts` (frontend calls it but it doesn't exist)

---

## Frontend Fixes

- [ ] Add Sepolia to chain config in `wagmi.ts` (currently only mainnet/polygon/optimism/arbitrum/base)
- [ ] Replace hardcoded `http://localhost:3001` in `page.tsx` with `process.env.NEXT_PUBLIC_API_URL`
- [ ] Replace `"YOUR_PROJECT_ID"` in `wagmi.ts` with actual WalletConnect project ID
- [ ] Update metadata in `layout.tsx` from "Create Next App" to "BLIP"
- [ ] Add World ID verification step before content upload

---

## Security

- [ ] Remove API keys from committed `.env` files (`attribution-agent/.env`, `backend/.env`)
- [ ] Add `.env` to `.gitignore` if not already
- [ ] Rotate exposed Pinata and Google API keys
