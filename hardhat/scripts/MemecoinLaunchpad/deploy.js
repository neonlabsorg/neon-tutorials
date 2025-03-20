const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

const BLOCKSCOUT_EXPLORER_URL = "https://neon-devnet.blockscout.com/tx/";
const MORASWAP_FACTORY_ADDRESS = "0x696d73D7262223724d60B2ce9d6e20fc31DfC56B";
const WSOL_TOKEN_ADDRESS = "0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c";
const ERC20_FOR_SPL_FACTORY_ADDRESS = "0xF6b17787154C418d5773Ea22Afc87A95CAA3e957";

// Constants for bonding curve
const BONDING_CURVE_A = 1e15; // A parameter for bonding curve
const BONDING_CURVE_B = 2e15; // B parameter for bonding curve
const FEE_PERCENT = 300; // 3% in basis points

// Helper function to log transaction with explorer link
async function logTransaction(tx, description) {
    const receipt = await tx.wait();
    console.log(`${description}: ${BLOCKSCOUT_EXPLORER_URL}${tx.hash}`);
    return receipt;
}

// Helper function to verify contract with delay
async function verifyContractWithDelay(address, constructorArguments) {
    try {
        await run("verify:verify", {
            address,
            constructorArguments,
        });
        console.log(`Contract verified at ${address}`);
    } catch (error) {
        console.log(`Verification failed: ${error.message}`);
        // Wait 30 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 30000));
        try {
            await run("verify:verify", {
                address,
                constructorArguments,
            });
            console.log(`Contract verified at ${address} after retry`);
        } catch (retryError) {
            console.log(`Verification failed after retry: ${retryError.message}`);
        }
    }
}

async function main() {
    console.log("Deploying MemecoinLaunchpad contracts...");

    // Get the signer
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // 1. Deploy BondingCurve
    console.log("\nDeploying BondingCurve...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(BONDING_CURVE_A, BONDING_CURVE_B);
    await logTransaction(bondingCurve.deploymentTransaction(), "BondingCurve deployment");
    const bondingCurveAddress = await bondingCurve.getAddress();
    console.log(`BondingCurve deployed to: ${bondingCurveAddress}`);

    // Verify BondingCurve
    console.log("\nVerifying BondingCurve...");
    await verifyContractWithDelay(bondingCurveAddress, [BONDING_CURVE_A, BONDING_CURVE_B]);

    // 2. Deploy TokenFactory
    console.log("\nDeploying TokenFactory...");
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    const tokenFactory = await TokenFactory.deploy(
        ERC20_FOR_SPL_FACTORY_ADDRESS,
        MORASWAP_ROUTER_ADDRESS,
        MORASWAP_FACTORY_ADDRESS,
        bondingCurveAddress,
        WSOL_TOKEN_ADDRESS,
        FEE_PERCENT
    );
    await logTransaction(tokenFactory.deploymentTransaction(), "TokenFactory deployment");
    const tokenFactoryAddress = await tokenFactory.getAddress();
    console.log(`TokenFactory deployed to: ${tokenFactoryAddress}`);

    // Verify TokenFactory
    console.log("\nVerifying TokenFactory...");
    await verifyContractWithDelay(
        tokenFactoryAddress,
        [
            ERC20_FOR_SPL_FACTORY_ADDRESS,
            MORASWAP_ROUTER_ADDRESS,
            MORASWAP_FACTORY_ADDRESS,
            bondingCurveAddress,
            WSOL_TOKEN_ADDRESS,
            FEE_PERCENT
        ]
    );

    // Create config object
    const config = {
        MORASWAP_FACTORY_ADDRESS,
        WSOL_TOKEN_ADDRESS,
        ERC20_FOR_SPL_FACTORY_ADDRESS,
        TOKEN_FACTORY_ADDRESS: tokenFactoryAddress,
        BONDING_CURVE_ADDRESS: bondingCurveAddress,
        FEE_PERCENT
    };

    // Save config to file
    const configPath = path.join(__dirname, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\nConfig saved to: ${configPath}`);

    console.log("\n--- Deployment Completed Successfully ---");
    console.log("\nDeployed addresses:");
    console.log(JSON.stringify(config, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 