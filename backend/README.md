# BLIP Backend Setup

This backend will handle the x402 payment layer, Chainlink CRE workflow, and API endpoints for the BLIP platform.

## Installation

### 1. Initialize Node.js Project

```bash
cd backend
npm init -y
```

### 2. Install Core Dependencies

```bash
# Express.js framework and middleware
npm install express cors helmet morgan compression

# Authentication and security
npm install jsonwebtoken bcryptjs express-rate-limit

# Blockchain integration
npm install ethers @chainlink/external-adapter web3

# Database (choose one based on your preference)
# Option 1: PostgreSQL
npm install pg @types/pg
# Option 2: MongoDB
npm install mongoose
# Option 3: SQLite (for development)
npm install sqlite3

# File handling and IPFS
npm install multer sharp ipfs-http-client pinata-sdk

# Payment processing
npm install stripe coinbase-commerce-node

# Environment and configuration
npm install dotenv dotenv-safe

# Validation and utilities
npm install joi express-validator axios uuid

# Development dependencies
npm install -D typescript @types/node @types/express @types/cors @types/jsonwebtoken @types/bcryptjs @types/multer @types/uuid
npm install -D nodemon ts-node jest @types/jest supertest @types/supertest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

### 3. Project Structure

Create the following folder structure:

```
backend/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── app.ts
├── tests/
├── uploads/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

### 4. Environment Configuration

Create `.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=your_database_connection_string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Blockchain Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=your_contract_address

# IPFS Configuration
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# Payment Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
COINBASE_API_KEY=your_coinbase_api_key
COINBASE_WEBHOOK_SECRET=your_coinbase_webhook_secret

# Chainlink Configuration
CHAINLINK_JOB_ID=your_chainlink_job_id
CHAINLINK_ORACLE_ADDRESS=your_chainlink_oracle_address
CHAINLINK_NODE_URL=your_chainlink_node_url

# AI Attribution Service
ATTRIBUTION_SERVICE_URL=http://localhost:8000
ATTRIBUTION_API_KEY=your_attribution_api_key
```

### 5. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    },
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### 6. Package.json Scripts

Update your `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts"
  }
}
```

### 7. Start Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Key Backend Components

### 1. x402 Payment Layer
- Handles payment processing and verification
- Manages access tokens for licensed content
- Integrates with Stripe and Coinbase Commerce

### 2. Chainlink CRE Workflow
- Validates content registrations
- Enforces attribution rules
- Interfaces with smart contracts

### 3. API Endpoints
- Content registration and management
- User authentication and authorization
- Payment processing and webhooks
- IPFS file upload and retrieval

### 4. Database Models
- User accounts and profiles
- Content metadata and licenses
- Payment transactions and history
- Attribution records and reports

## Next Steps

1. Set up the basic Express server structure
2. Implement authentication middleware
3. Create database models and schemas
4. Develop API routes for each component
5. Integrate with blockchain contracts
6. Set up payment processing webhooks
7. Implement IPFS file handling
8. Add comprehensive error handling and logging

This backend setup provides all the necessary dependencies and structure to implement the BLIP MVP's server-side components.