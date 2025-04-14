# Direct Solana Scripts

This directory contains scripts for direct interaction with Solana programs from Neon EVM.

## 📝 Scripts

1. **createAmmPool.js**: Creates an AMM (Automated Market Maker) pool on Solana
2. **createCpmmPool.js**: Creates a CPMM (Constant Product Market Maker) pool
3. **lockLiquidityCpmm.js**: Locks liquidity in a CPMM pool
4. **createMarket.js**: Creates a new market on Solana
5. **utils.js**: Utility functions for Solana interactions
6. **config.js**: Configuration settings for Solana programs

## 🔄 Usage

### 📋 Prerequisites

- ✅ Node.js and npm installed
- ✅ Hardhat configured for Neon network
- ✅ Funded wallet on Neon network
- ✅ Follow the [Anchor Wallet Setup](../../README.md#anchor-wallet-setup) instructions in the main README

### 🚀 Running Scripts

To run any of the scripts:

```bash
npx hardhat run scripts/DirectSolanaScripts/<script-name>.js --network neondevnet
```

Replace `<script-name>` with the name of the script you want to run.

## ⚙️ Configuration

The `config.js` file contains the following configuration parameters:

- Solana RPC endpoints
- Program IDs
- Token addresses
- Pool parameters

## 🔄 Transaction Flow

1. **Pool Creation**: Creates either an AMM or CPMM pool
2. **Market Creation**: Sets up a new market
3. **Liquidity Locking**: Locks liquidity in the created pool

## ❓ Troubleshooting

If you encounter issues:

1. 💰 Ensure your wallet has sufficient SOL
2. ✅ Check that the `config.js` file contains valid addresses
3. 🔍 Verify the transactions on Solana Explorer 