// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { NEON_CONFIG } = require("../NEON_CONFIG");

async function main() {
    const TestReadSolanaDataFactory = await ethers.getContractFactory(
        "TestReadSolanaData"
    );
    const TestReadSolanaDataAddress = "0xAbeE635906d33493ac5092fb3e598458b3277DA5";
    let TestReadSolanaData;

    if (ethers.isAddress(TestReadSolanaDataAddress)) {
        TestReadSolanaData = TestReadSolanaDataFactory.attach(
        TestReadSolanaDataAddress
        );
    } else {
        TestReadSolanaData = await ethers.deployContract("TestReadSolanaData");
        await TestReadSolanaData.waitForDeployment();

        console.log(`TestReadSolanaData deployed to ${TestReadSolanaData.target}`);
    }

    let neonPrice = await TestReadSolanaData.readSolanaDataPrice(
        NEON_CONFIG.PYTH_PRICE_FEEDS.NEON_USD,
        208, // offset for current updated price
        8 // length of current updated price
    );
    console.log(neonPrice);

    let solPrice = await TestReadSolanaData.readSolanaDataPrice(
        NEON_CONFIG.PYTH_PRICE_FEEDS.SOL_USD,
        208, // offset for current updated price
        8 // length of current updated price
    );
    console.log(solPrice);

    let ethPrice = await TestReadSolanaData.readSolanaDataPrice(
        NEON_CONFIG.PYTH_PRICE_FEEDS.ETH_USD,
        208, // offset for current updated price
        8 // length of current updated price
    );
    console.log(ethPrice);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
