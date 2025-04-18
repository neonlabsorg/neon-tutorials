# ERC721 NFT Example on Neon EVM

This tutorial demonstrates how to deploy and interact with ERC721 NFTs on Neon EVM.

## 📝 Overview

This example shows how to:
1. Deploy an ERC721 NFT contract
2. Mint NFTs to specified addresses
3. Transfer NFTs between accounts
4. Check NFT ownership

## 🔄 Usage

### 📋 Prerequisites

- ✅ Node.js and npm installed
- ✅ Hardhat configured for Neon network
- ✅ Funded wallet on Neon network

### 🚀 Deployment

To deploy the contract:

```bash
npx hardhat run scripts/TestERC721/deploy.js --network neondevnet
```

## ⚙️ Configuration

The NFT contract uses the following parameters:
- Token name
- Token symbol
- Base URI for metadata
- Maximum supply (if applicable)

## 🔄 Transaction Flow

1. **Deployment**: Deploy the ERC721 NFT contract
2. **Minting**: Mint NFTs to specified addresses
3. **Transfers**: Transfer NFTs between accounts
4. **Ownership Checks**: Verify NFT ownership

## ❓ Troubleshooting

If you encounter issues:

1. 💰 Ensure your wallet has sufficient NEON tokens
2. ✅ Check that the contract parameters are valid
3. 🔍 Verify the transactions on the Neon Explorer
