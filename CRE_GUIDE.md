# ChainBridge AI: CRE Workflow Guide

This guide explains how to manage and run the decentralized Bridge Execution workflows using the Docker-wrapped CRE CLI.

## 🛠 Prerequisites

Ensure you have Docker installed and the `cre-docker/run.sh` script is executable:

```bash
chmod +x cre-docker/run.sh
```

## 🔐 Authentication

To connect your local environment to your Chainlink CRE account:

```bash
./cre-docker/run.sh login
```
*This will open a browser window for authentication.*

## 🚀 Simulation

To test the Bridge Execution workflow locally:

1. **Go to the project root**:
   ```bash
   cd blip-cre
   ```

2. **Run simulation**:
   ```bash
   ../cre-docker/run.sh workflow simulate ./bridge-execution --target dev -R .
   ```

## 🌐 Dashboard & Deployment

**Do you need to manually set it up on the website?**
Not exactly. Once you are happy with the simulation, you **deploy** it from the CLI.

1. **Deploy the workflow**:
   ```bash
   ../cre-docker/run.sh workflow deploy ./bridge-execution --target dev
   ```
2. **Visit the Dashboard**: After deployment, the workflow will appear on [cre.chain.link](https://cre.chain.link).
3. **Manage on Website**: You'll use the website to:
   - View execution logs and history.
   - Manage environment variables (secrets).
   - See cost/billing for the workflow execution.
   - Monitor the health of the triggers.

## 🏗 Workflow Logic

The workflow is located in `blip-cre/cre-workflow/src/workflow.ts`. It performs the following steps:
1. **Trigger**: Received an HTTP request with bridge intent data.
2. **Verification**: Calls the backend to verify the World ID proof.
3. **Validation**: Ensures the intent is valid for the specified user and amount.
4. **Execution**: (In production) Triggers on-chain finalization via the `CCIPExecutionVault`.

## ⚙️ Configuration

- **Project Config**: `blip-cre/project.yaml`
- **Workflow Config**: `blip-cre/cre-workflow/workflow.yaml`

### Key Configuration Fields:
- `vaultAddress`: The address of the `CCIPExecutionVault` on World Chain.
- `worldIdVerifyUrl`: The internal backend endpoint for identity verification.

## 📦 External Adapter

The `cre-adapter` (located in `cre-adapter/`) acts as a bridge between Chainlink nodes and our AI Attribution Agent. It can be used within the workflow to provide additional validation or analysis.
