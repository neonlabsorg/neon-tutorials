# Memecoin Launchpad with Raydium Integration

> **⚠️ DISCLAIMER**: This is a demo project for testing purposes only. The contracts and scripts have not been audited and should not be used in production. Use at your own risk.

This directory contains scripts for deploying and testing the Memecoin Launchpad smart contracts on the Neon EVM network, now integrated with Raydium DEX on Solana.

## Contracts

1. **BondingCurve**: Implements the bonding curve algorithm for token price calculation.
2. **TokenFactory**: Main contract that creates ERC20 tokens, manages the funding and trading phases, and creates Raydium liquidity pools.
3. **ERC20ForSplMintable**: Token contract backed by SPL tokens.
4. **CallSolana**: Contract that enables cross-chain calls from Neon EVM to Solana.

## Deployment Process

The deployment script ([`deploy.js`](deploy.js)) performs the following actions:

1. Deploys the `BondingCurve` contract with preset parameters
2. Deploys the `TokenFactory` contract with the following dependencies:
   - ERC20ForSplFactory address
   - BondingCurve address
   - WSOL token address
   - Fee percentage (in basis points)
3. Verifies both contracts on the Neon Blockscout explorer
4. Saves all contract addresses and Raydium configuration to a [`config.json`](config.json) file for later use

## Testing Process

The test script ([`demo.js`](demo.js)) loads the contract addresses from the [`config.json`](config.json) file and performs these actions:

1. Creates a new token through the `TokenFactory`
2. Retrieves and converts the Solana token mint addresses for integration with Raydium
3. Executes a first buy transaction (25% of funding goal)
4. Sells 50% of the acquired tokens
5. Performs a final buy to meet the funding goal, which triggers the creation of a Raydium liquidity pool
6. Locks the liquidity in the Raydium pool
7. Verifies that the token state has changed to TRADING

## Solana Integration

The launchpad now uses cross-chain functionality to:

1. Create SPL tokens via the ERC20ForSpl factory
2. Create Raydium CPMM liquidity pools when funding goals are met
3. Convert between EVM addresses (hex) and Solana addresses (base58) automatically

## Usage

### Prerequisites

- Node.js and npm installed
- Hardhat configured for Neon network
- Funded wallet on Neon network
- Raydium SDK v2 installed (`npm install @raydium-io/raydium-sdk-v2`)
- Solana web3.js installed (`npm install @solana/web3.js @solana/spl-token`)
- Solana wallet keypair file (`id.json`) for creating Associated Token Accounts (ATAs)
- Set the `ANCHOR_WALLET` environment variable to point to your `id.json` file:
  ```bash
  export ANCHOR_WALLET=./id.json
  ```

### Solana Wallet Setup

The project requires a Solana wallet keypair file (`id.json`) for creating Associated Token Accounts (ATAs) and interacting with Solana programs. This is the standard format used by Anchor framework and is compatible with various Solana programs including Orca, Raydium, and other DeFi protocols on Solana.

To set up your wallet:
1. Set the `ANCHOR_WALLET` environment variable to point to your `id.json` file:
  ```bash
  export ANCHOR_WALLET=./id.json
  ```

### Converting Phantom Wallet Private Key to id.json

If you're using a Phantom wallet, you'll need to convert your private key to the `id.json` format:

1. Export your private key from Phantom wallet (Settings -> Export Private Key)

2. Edit the [`convert-key.js`](convert-key.js) script in this directory:
   - Replace the `privateKey` value with your exported private key
   - ⚠️ **IMPORTANT**: Never commit your private key to the script or any repository
   - ⚠️ **IMPORTANT**: Make sure to remove your private key from the script after use
   - Run the script:
   ```bash
   node convert-key.js
   ```

3. The script will create an `id.json` file. Make sure to:
   - Keep this file secure and never share it
   - Set the correct permissions: `chmod 600 id.json`
   - Set the `ANCHOR_WALLET` environment variable as shown above
   - ⚠️ **IMPORTANT**: Never commit the `id.json` file to any repository

### Deployment

To deploy the contracts and generate the configuration file:

```bash
npx hardhat run scripts/MemecoinLaunchpad/deploy.js --network neondevnet
```

This will deploy both contracts and create a [`config.json`](config.json) file with all necessary addresses and Raydium configuration.

### Testing

After deployment, you can test the functionality with:

```bash
npx hardhat run scripts/MemecoinLaunchpad/demo.js --network neondevnet
```

This script will use the addresses from the [`config.json`](config.json) file to interact with the deployed contracts and create a Raydium liquidity pool.

## Configuration Parameters

Default parameters:

- **BONDING_CURVE_A**: 1e15
- **BONDING_CURVE_B**: 2e15
- **FEE_PERCENT**: 300 (3%)
- **FUNDING_GOAL**: 0.1 SOL

Raydium parameters:
- **CREATE_CPMM_POOL_PROGRAM**: Raydium CPMM pool creation program ID
- **CREATE_CPMM_POOL_FEE_ACC**: Raydium fee account address
- **DEV_LOCK_CPMM_PROGRAM**: Raydium lock CPMM program ID
- **DEV_LOCK_CPMM_AUTH**: Raydium lock CPMM auth address

## Address Conversion

The script automatically handles conversion between:

- Ethereum/Neon addresses (hex format, e.g., 0x123...)
- Solana addresses (base58 format, e.g., So111...)
- Token mint addresses (needed for Raydium integration)

## Transaction Flow

1. **Token Creation**: Creates a new ERC20 token with specified name and symbol
2. **First Buy**: Initial purchase of 25% of the funding goal
3. **Sell**: Sells 50% of the acquired tokens
4. **Final Buy with Raydium Integration**: Purchases remaining amount to meet funding goal
5. **Raydium Pool Creation**: Automatically creates a CPMM pool on Raydium when funding goal is met
6. **Liquidity Locking**: Locks the liquidity in the Raydium pool using external authority

## Troubleshooting

If you encounter any issues:

1. Ensure your wallet has sufficient WSOL for transactions
2. Check that the `config.json` file exists and contains valid addresses
3. Verify the deployed contracts on Blockscout explorer
4. Check Solana Explorer for created pools and token mints 