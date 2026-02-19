# BLIP MVP Dependencies Guide

This document outlines all the dependencies needed to implement the BLIP MVP across different components.

## Frontend (Next.js) Dependencies

Since you already have Next.js installed, here are the additional dependencies needed for the web interface:

### Core Dependencies

```bash
npm install @ethersproject/providers @ethersproject/contracts
npm install web3
npm install @walletconnect/web3-provider
npm install @coinbase/wallet-sdk
npm install axios
npm install @headlessui/react
npm install @heroicons/react
npm install tailwindcss
npm install autoprefixer
npm install postcss
npm install react-hook-form
npm install react-query
npm install swr
```

### Development Dependencies

```bash
npm install -D @types/node
npm install -D eslint
npm install -D eslint-config-next
npm install -D prettier
npm install -D prettier-plugin-tailwindcss
```

## Smart Contract Dependencies

### Hardhat Development Environment

```bash
npm install --save-dev hardhat
npm install --save-dev @nomiclabs/hardhat-ethers
npm install --save-dev @nomiclabs/hardhat-waffle
npm install --save-dev @nomiclabs/hardhat-etherscan
npm install --save-dev hardhat-gas-reporter
npm install --save-dev solidity-coverage
npm install --save-dev chai
npm install --save-dev ethers
npm install --save-dev @openzeppelin/contracts
npm install --save-dev @openzeppelin/contracts-upgradeable
npm install --save-dev @chainlink/contracts
```

## Chainlink CRE Adapter Dependencies

### Core Dependencies

```bash
npm install @chainlink/external-adapter
npm install axios
npm install dotenv
npm install express
npm install cors
npm install helmet
npm install web3
npm install ethers
npm install @types/express
npm install @types/cors
npm install typescript
npm install ts-node
npm install nodemon
```

## AI Attribution Agent Dependencies

### Python Dependencies

```bash
pip install numpy
pip install pandas
pip install scikit-learn
pip install transformers
pip install torch
pip install tensorflow
pip install nltk
pip install spacy
pip install textdistance
pip install requests
pip install python-dotenv
pip install fastapi
pip install uvicorn
pip install pydantic
```

### Additional Python Setup

```bash
python -m spacy download en_core_web_sm
python -m nltk.downloader punkt
python -m nltk.downloader stopwords
```

## x402 Payment Layer Dependencies

### Core Dependencies

```bash
npm install express
npm install cors
npm install helmet
npm install jsonwebtoken
npm install bcryptjs
npm install stripe
npm install coinbase-commerce-node
npm install ethers
npm install web3
npm install axios
npm install dotenv
npm install express-rate-limit
npm install express-validator
```

### Development Dependencies

```bash
npm install -D @types/express
npm install -D @types/cors
npm install -D @types/jsonwebtoken
npm install -D @types/bcryptjs
npm install -D typescript
npm install -D ts-node
npm install -D nodemon
npm install -D jest
npm install -D supertest
```

## IPFS and Storage Dependencies

### Core Dependencies

```bash
npm install ipfs-http-client
npm install pinata-sdk
npm install multer
npm install sharp
```

## Testing Dependencies

### Frontend Testing

```bash
npm install -D jest
npm install -D @testing-library/react
npm install -D @testing-library/jest-dom
npm install -D @testing-library/user-event
npm install -D jest-environment-jsdom
```

### Smart Contract Testing

```bash
npm install --save-dev hardhat-deploy
npm install --save-dev @nomiclabs/hardhat-ethers
npm install --save-dev ethereum-waffle
```

## Development Tools

### Code Quality

```bash
npm install -D eslint
npm install -D eslint-config-prettier
npm install -D eslint-plugin-react
npm install -D eslint-plugin-react-hooks
npm install -D prettier
npm install -D husky
npm install -D lint-staged
```

### Documentation

```bash
npm install -D typedoc
npm install -D @typedoc/plugin-markdown
```

## Environment Configuration

### Create .env files for each component:

#### Frontend (.env.local)

```
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Smart Contracts (.env)

```
PRIVATE_KEY=your_private_key
INFURA_PROJECT_ID=your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
COINBASE_API_KEY=your_coinbase_api_key
```

#### Chainlink CRE (.env)

```
ETHEREUM_RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
ATTRIBUTION_AGENT_URL=http://localhost:8000
```

#### AI Attribution Agent (.env)

```
OPENAI_API_KEY=your_openai_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
DATABASE_URL=your_database_url
```

#### Payment Gateway (.env)

```
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
COINBASE_API_KEY=your_coinbase_api_key
ETHEREUM_RPC_URL=http://localhost:8545
```

## Installation Order

1. **Install Node.js dependencies** (if not already installed):

   ```bash
   npm install -g npm@latest
   ```

2. **Install Python and pip** (if not already installed):

   ```bash
   # On Ubuntu/Debian
   sudo apt update
   sudo apt install python3 python3-pip python3-venv

   # On macOS
   brew install python3
   ```

3. **Create project structure**:

   ```bash
   mkdir contracts cre-adapter attribution-agent payment-gateway web-interface
   ```

4. **Install dependencies for each component** in their respective directories following the order above.

## Quick Start Script

#### Development Tools (Global)
- **cre CLI**: `npm install -g @smartcontractkit/cre-cli` (or manual download)
- **Bun**: `curl -fsSL https://bun.sh/install | bash` (Required for local CRE simulation)

Create a `setup.sh` script in the root directory:

```bash
#!/bin/bash

echo "Setting up BLIP MVP dependencies..."

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd web-interface
npm install
cd ..

# Install smart contract dependencies
echo "Installing smart contract dependencies..."
cd contracts
npm install
cd ..

# Install CRE adapter dependencies
echo "Installing CRE adapter dependencies..."
cd cre-adapter
npm install
cd ..

# Install payment gateway dependencies
echo "Installing payment gateway dependencies..."
cd payment-gateway
npm install
cd ..

# Set up Python environment for attribution agent
echo "Setting up attribution agent environment..."
cd attribution-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

echo "Dependencies installation complete!"
echo "Remember to configure your .env files for each component."
```

Make it executable:

```bash
chmod +x setup.sh
```

## Version Compatibility

- Node.js: >= 16.0.0
- Python: >= 3.8.0
- npm: >= 8.0.0
- Hardhat: >= 2.0.0
- Next.js: >= 13.0.0

### Local Blockchain

For development, you'll need a local blockchain node:

```bash
# Install Ganache CLI
npm install -g ganache-cli

# Or use Hardhat's built-in network
npx hardhat node
```

This dependencies guide covers all the components needed for the BLIP MVP implementation. Make sure to configure your environment variables properly before running each component.
