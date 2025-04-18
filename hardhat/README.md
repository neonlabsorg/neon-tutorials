# Neon tutorials with Hardhat

This directory contains several examples to deploy smart contracts on Neon EVM Devnet or Mainnet.

## 📋 Prerequisites

1. Clone the repository:
```sh
git clone https://github.com/neonlabsorg/neon-tutorials.git
```

2. Navigate to the hardhat directory:
```sh
cd neon-tutorials/hardhat
```

3. Install dependencies:
```sh
npm install
```

## 🔧 Setup

### Metamask Configuration
1. Go to [Chainlist](https://chainlist.org/?search=Neon+EVM&testnets=true) and add the Neon EVM DevNet and Neon EVM MainNet networks to your Metamask wallet.
2. Airdrop at most 100 NEONs to the created **account #1** [from here](https://neonfaucet.org/)
3. Copy your Metamask account's private key (Account Details >> Export Private Key) and insert them into **.env**. For demos that use the user1 and user2 keys, create two additional accounts in Metamask and repeat this step for them.

### Environment Setup
Create a .env file in the root project folder and add these lines:
```sh
PRIVATE_KEY_OWNER=<1ST_PRIVATE_KEY>
USER1_KEY=<2ND_PRIVATE_KEY>
USER2_KEY=<3RD_PRIVATE_KEY>
```

### Dependency Setup

#### Anchor Wallet (Required for Solana Integration)
For tutorials that interact with Solana programs:
```sh
npm install @solana/web3.js @solana/spl-token bs58
```
Follow the [Anchor Wallet Setup](#anchor-wallet-setup) instructions below.

#### API3 (Required for API3 Price Feeds)
For API3 price feed integration:
```sh
npm install @api3/airnode-protocol-v1
```

#### Chainlink (Required for Chainlink Integration)
For Chainlink oracle integration:
```sh
npm install @chainlink/contracts
```

#### Raydium (Required for Memecoin Launchpad)
For Raydium DEX integration:
```sh
npm install @raydium-io/raydium-sdk-v2
```

### Anchor Wallet Setup
For tutorials that interact with Solana programs, you'll need to set up an Anchor wallet:

1. Convert your Phantom wallet private key to an Anchor wallet:
   - Edit `convert-key.js` and replace `<your-private-key>` with your Phantom wallet private key
   - Run: `node convert-key.js`
   - This will create an `id.json` file

2. Set up the Anchor wallet environment:
```sh
chmod 600 id.json
export ANCHOR_WALLET=./id.json
```

⚠️ **Security Notes**:
- Never commit your private key or id.json file
- Keep the id.json file secure and never share it
- Set appropriate file permissions: `chmod 600 id.json`

## 📚 Tutorials

1. [Memecoin Launchpad with Raydium Integration](./scripts/MemecoinLaunchpad/README.md) (Requires Raydium SDK and Anchor wallet)
2. [API3 Price Feeds Integration](./scripts/TestAPI3/README.md) (Requires API3 Protocol)
3. [Direct Solana Scripts](./scripts/DirectSolanaScripts/README.md) (Requires Anchor wallet)
4. [Test Call Solana](./scripts/TestCallSolana/README.md) (Requires Anchor wallet)
5. [Test Chainlink](./scripts/TestChainlink/README.md) (Requires Chainlink Contracts)
6. [Test ERC20](./scripts/TestERC20/README.md)
7. [Test ERC721](./scripts/TestERC721/README.md)
8. [Test Read Solana Data](./scripts/TestReadSolanaData/README.md) (Requires Anchor wallet)

## 🔍 Contract Verification

### On NeonScan
```sh
npx hardhat verify --network neondevnet <CONTRACT_ADDRESS>
```

For contracts with constructor parameters:
```sh
npx hardhat verify --network neondevnet <CONTRACT_ADDRESS> <PARAM_1> <PARAM_2>
```

### On Blockscout
To verify on Blockscout, update the `hardhat.config.js` with the following configuration:
```sh
etherscan: {
    apiKey: {
      neonevm: "test",
    },
    customChains: [
      {
        network: "neonevm",
        chainId: 245022926,
        urls: {
          apiURL: "https://neon-devnet.blockscout.com/api",
          browserURL: "https://neon-devnet.blockscout.com",
        },
      },
      {
        network: "neonevm",
        chainId: 245022934,
        urls: {
          apiURL: "https://neon.blockscout.com/api",
          browserURL: "https://neon.blockscout.com",
        },
      },
    ],
},
```

Then run the verification command:
```sh
npx hardhat verify --network neondevnet <CONTRACT_ADDRESS>
```
