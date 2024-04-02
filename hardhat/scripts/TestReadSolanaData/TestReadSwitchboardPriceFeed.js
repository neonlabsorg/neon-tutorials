// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, network } = require("hardhat");
const { NEON_CONFIG } = require("../NEON_CONFIG");

async function main() {
    let TestReadSwitchboardPriceFeed = await ethers.deployContract("TestReadSwitchboardPriceFeed");
    await TestReadSwitchboardPriceFeed.waitForDeployment();

    console.log(
        `TestReadSwitchboardPriceFeed deployed to ${TestReadSwitchboardPriceFeed.target}`
    );

    const SWITCHBOARD_DEVNET_PRICEFEEDS = {
        SOL_USD: '0xec81105112a257d61df4cf5f13ee0a1b019197c8c5343b4f2a7ec8846ae22c1a',
        ETH_USD: '0xf339767030404ff95a7fc45537a69f9cdd5fb3c58a9dbc67c72a144adf7f0248',
        BTC_USD: '0x6e8c497783de005964f692d15bc4d51022b1758ccc00842984463f0b7fdffe9f'
    };

    let solPrice = await TestReadSwitchboardPriceFeed.readSolanaPythPriceFeed(
        SWITCHBOARD_DEVNET_PRICEFEEDS.SOL_USD,
        0,
        await TestReadSwitchboardPriceFeed.readSolanaDataAccountLen(SWITCHBOARD_DEVNET_PRICEFEEDS.SOL_USD)
    );
    console.log(solPrice, 'solPrice');

    let ethPrice = await TestReadSwitchboardPriceFeed.readSolanaPythPriceFeed(
        SWITCHBOARD_DEVNET_PRICEFEEDS.ETH_USD,
        0,
        await TestReadSwitchboardPriceFeed.readSolanaDataAccountLen(SWITCHBOARD_DEVNET_PRICEFEEDS.ETH_USD)
    );
    console.log(ethPrice, 'ethPrice');

    let btcPrice = await TestReadSwitchboardPriceFeed.readSolanaPythPriceFeed(
        SWITCHBOARD_DEVNET_PRICEFEEDS.BTC_USD,
        0,
        await TestReadSwitchboardPriceFeed.readSolanaDataAccountLen(SWITCHBOARD_DEVNET_PRICEFEEDS.BTC_USD)
    );
    console.log(btcPrice, 'btcPrice');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});