# ERC20 Token Example on Neon EVM

This tutorial demonstrates how to deploy and interact with ERC20 tokens on Neon EVM.

## 📝 Overview

This example shows how to:
1. Deploy an ERC20 token contract
2. Mint tokens to specified addresses
3. Transfer tokens between accounts
4. Check token balances

## 🔄 Usage

### 📋 Prerequisites

- ✅ Node.js and npm installed
- ✅ Hardhat configured for Neon network
- ✅ Funded wallet on Neon network

### 🚀 Deployment

To deploy the contract:

```bash
npx hardhat run scripts/TestERC20/deploy.js --network neondevnet
```

## ⚙️ Configuration

The token contract uses the following parameters:
- Token name
- Token symbol
- Initial supply
- Decimal places

## 🔄 Transaction Flow

1. **Deployment**: Deploy the ERC20 token contract
2. **Minting**: Mint initial supply to the owner
3. **Transfers**: Transfer tokens between accounts
4. **Balance Checks**: Verify token balances

## ❓ Troubleshooting

If you encounter issues:

1. 💰 Ensure your wallet has sufficient NEON tokens
2. ✅ Check that the contract parameters are valid
3. 🔍 Verify the transactions on the Neon Explorer
