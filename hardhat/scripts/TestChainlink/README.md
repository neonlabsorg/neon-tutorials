# Chainlink Integration Example on Neon EVM

This tutorial demonstrates how to integrate Chainlink oracles into your smart contracts on Neon EVM.

## 📝 Overview

This example shows how to:
1. Deploy a contract that uses Chainlink oracles
2. Request and receive data from Chainlink
3. Handle oracle responses and callbacks

## 🔄 Usage

### 📋 Prerequisites

- ✅ Node.js and npm installed
- ✅ Hardhat configured for Neon network
- ✅ Funded wallet on Neon network
- ✅ Install Chainlink Contracts: Follow the [Chainlink Setup](../../README.md#dependency-setup) instructions in the main README

### 🚀 Deployment

To deploy the contract:

```bash
npx hardhat run scripts/TestChainlink/deploy.js --network neondevnet
```

## ⚙️ Configuration

The contract uses the following Chainlink components:
- Oracle contract address
- Job ID
- LINK token address

## 🔄 Transaction Flow

1. **Request Data**: Send a request to the Chainlink oracle
2. **Oracle Processing**: Wait for the oracle to process the request
3. **Callback**: Receive and handle the oracle's response

## ❓ Troubleshooting

If you encounter issues:

1. 💰 Ensure your wallet has sufficient LINK tokens
2. ✅ Check that the oracle address and job ID are correct
3. 🔍 Verify the oracle requests on the Chainlink dashboard
