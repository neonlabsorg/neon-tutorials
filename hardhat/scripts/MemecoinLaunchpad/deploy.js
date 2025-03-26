const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { DEVNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");

const BLOCKSCOUT_EXPLORER_URL = "https://neon-devnet.blockscout.com/tx/";
const WSOL_TOKEN_ADDRESS = "0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c";
const ERC20_FOR_SPL_FACTORY_ADDRESS = "0xF6b17787154C418d5773Ea22Afc87A95CAA3e957";

// Constants for bonding curve
const BONDING_CURVE_A = 1e15; // A parameter for bonding curve
const BONDING_CURVE_B = 2e15; // B parameter for bonding curve
const FEE_PERCENT = 300; // 3% in basis points

// Raydium constants
const RAYDIUM_CREATE_CPMM_POOL_PROGRAM = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;
const RAYDIUM_CREATE_CPMM_POOL_FEE_ACC = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC;

// Helper function to log transaction with explorer link
async function logTransaction(tx, description) {
    const receipt = await tx.wait();
    console.log(`✅ ${description}: ${BLOCKSCOUT_EXPLORER_URL}${tx.hash}`);
    return receipt;
}

async function sleep(ms) {
    console.log(`⏳ Waiting ${ms / 1000} seconds before verification...`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to verify contract
async function verifyContract(address, constructorArguments) {
    await sleep(20000);
    try {
        await run("verify:verify", {
            address,
            constructorArguments,
        });
        console.log(`✅ Contract verified at ${address}`);
    } catch (error) {
        if (error.message.includes("Smart-contract already verified")) {
            console.log(`ℹ️  Contract already verified at ${address}`);
        } else {
            console.error(`❌ Verification failed:`, error);
            throw error;
        }
    }
}

async function main() {
    console.log("\n🚀 Deploying MemecoinLaunchpad contracts with Raydium integration...");

    // Get the signer
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deploying with account: ${deployer.address}`);

    // 1. Deploy BondingCurve
    console.log("\n📝 Step 1: Deploying BondingCurve...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(BONDING_CURVE_A, BONDING_CURVE_B);
    await logTransaction(bondingCurve.deploymentTransaction(), "BondingCurve deployment");
    const bondingCurveAddress = await bondingCurve.getAddress();
    console.log(`   Contract address: ${bondingCurveAddress}`);

    // Verify BondingCurve
    console.log("\n🔍 Verifying BondingCurve...");
    await verifyContract(bondingCurveAddress, [BONDING_CURVE_A, BONDING_CURVE_B]);

    // 2. Deploy TokenFactory
    console.log("\n📝 Step 2: Deploying TokenFactory...");
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    const tokenFactory = await TokenFactory.deploy(
        ERC20_FOR_SPL_FACTORY_ADDRESS,
        bondingCurveAddress,
        WSOL_TOKEN_ADDRESS,
        FEE_PERCENT
    );
    await logTransaction(tokenFactory.deploymentTransaction(), "TokenFactory deployment");
    const tokenFactoryAddress = await tokenFactory.getAddress();
    console.log(`   Contract address: ${tokenFactoryAddress}`);

    // Verify TokenFactory
    console.log("\n🔍 Verifying TokenFactory...");
    await verifyContract(tokenFactoryAddress, [
        ERC20_FOR_SPL_FACTORY_ADDRESS,
        bondingCurveAddress,
        WSOL_TOKEN_ADDRESS,
        FEE_PERCENT
    ]);

    // Create config object
    const config = {
        WSOL_TOKEN_ADDRESS,
        ERC20_FOR_SPL_FACTORY_ADDRESS,
        TOKEN_FACTORY_ADDRESS: tokenFactoryAddress,
        BONDING_CURVE_ADDRESS: bondingCurveAddress,
        FEE_PERCENT,
        SOLANA_RPC_URL: "https://api.devnet.solana.com",
        TOKENS: {
            WSOL_MINT: "So11111111111111111111111111111111111111112"
        }
    };

    // Save config to file
    const configPath = path.join(__dirname, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n💾 Config saved to: ${configPath}`);

    console.log("\n✨ Deployment Completed Successfully ✨");
    console.log("\n📋 Deployed addresses:");
    console.log(JSON.stringify(config, null, 2));
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
}); 