# API3 Price Feeds Integration Example on Neon EVM Mainnet and Devnet

This tutorial demonstrates how to integrate API3 price feeds into your smart contracts on Neon EVM.

## 📝 Overview

This example shows how to:
1. Deploy a contract that uses API3 price feeds
2. Read price data from various feeds
3. Handle price updates and timestamps

## 🔄 Usage

### 📋 Prerequisites

- ✅ Node.js and npm installed
- ✅ Hardhat configured for Neon network
- ✅ Funded wallet on Neon network
- ✅ Install API3 Protocol: Follow the [API3 Setup](../../README.md#dependency-setup) instructions in the main README

### 🚀 Deployment

To deploy the contract:

```bash
npx hardhat run scripts/TestAPI3/deploy.js --network neondevnet
```

The output will look like this:
```sh
TestAPI3 deployed to 0xB8747279e8029108720BcB5386511D70B9129D68
BTC_USD Result(2) [ 64547812100000000000000n, 1721241637n ]
ETH_USD Result(2) [ 3431460000000000000000n, 1721274476n ]
SOL_USD Result(2) [ 159776804400000000000n, 1721284955n ]
USDC_USD Result(2) [ 999900024820969500n, 1721220644n ]
USDT_USD Result(2) [ 1000188700000000000n, 1721220738n ]
NEON_USD Result(2) [ 392570000000000000n, 1721270758n ]
LINK_USD Result(2) [ 13807707000000000000n, 1721291017n ]
```

The result represents an array with:
- 1st parameter - Price
- 2nd parameter - Timestamp of the last price push

## ⚙️ Available Price Feeds

The contract supports the following price feeds:
- BTC/USD
- ETH/USD
- SOL/USD
- USDC/USD
- USDT/USD
- NEON/USD
- LINK/USD

## ❓ Troubleshooting

If you encounter issues:

1. 💰 Ensure your wallet has sufficient NEON tokens
2. ✅ Check that the API3 proxy addresses are correct
3. 🔍 Verify the price feed data on the API3 dashboard
