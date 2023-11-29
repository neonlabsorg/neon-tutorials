// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();

    const ERC721ForSPLFactory = await hre.ethers.getContractFactory('ERC721ForSPL');
    const ERC721ForSPL = await upgrades.deployProxy(ERC721ForSPLFactory, [
        'TestNft',
        'TST'
    ], {kind: 'uups'});
    await ERC721ForSPL.waitForDeployment();

    console.log(
        `ERC721ForSPL proxy deployed to ${ERC721ForSPL.target}`
    );
    console.log(
        `ERC721ForSPL implementation deployed to ${await upgrades.erc1967.getImplementationAddress(ERC721ForSPL.target)}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});