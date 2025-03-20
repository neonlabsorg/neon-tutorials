const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

const BLOCKSCOUT_EXPLORER_URL = "https://neon-devnet.blockscout.com/tx/";

// Load config
let config;
try {
    const configPath = path.join(__dirname, "config.json");
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("Loaded config file successfully");
} catch (error) {
    console.error("Failed to load config file:", error.message);
    console.log("Please run deploy.js first to generate the config file");
    process.exit(1);
}

const {
    MORASWAP_FACTORY_ADDRESS,
    MORASWAP_ROUTER_ADDRESS,
    WSOL_TOKEN_ADDRESS,
    ERC20_FOR_SPL_FACTORY_ADDRESS,
    TOKEN_FACTORY_ADDRESS,
    BONDING_CURVE_ADDRESS,
    FEE_PERCENT
} = config;

// Funding goal: 0.1 SOL
const FUNDING_GOAL_MULTIPLIER = 100000000n; // 0.1 SOL (0.1 * 10^9)
const FIRST_BUY_PERCENTAGE = 50n; // Buy 50% of funding goal initially
const FINAL_BUY_BUFFER = 120n; // 20% buffer to ensure we reach the goal
const TOKEN_NAME = "Neon Meme Token8";
const TOKEN_SYMBOL = "NMEME8";
const SELL_PERCENTAGE = 10n; // Sell 10% of tokens
const TOKEN_DECIMALS = 9;

// Enum to match TokenFactory.sol's TokenState enum
const TokenState = {
    NOT_CREATED: 0n,
    FUNDING: 1n,
    TRADING: 2n
};

// Helper function to log transaction with explorer link
async function logTransaction(tx, description) {
    const receipt = await tx.wait();
    console.log(`${description}: ${BLOCKSCOUT_EXPLORER_URL}${tx.hash}`);
    return receipt;
}

async function main() {
    console.log("Testing MemecoinLaunchpad contracts...");

    console.log(`Using contracts from config:`);
    console.log(`- TokenFactory: ${TOKEN_FACTORY_ADDRESS}`);
    console.log(`- ERC20ForSplFactory: ${ERC20_FOR_SPL_FACTORY_ADDRESS}`);
    console.log(`- WSOL token: ${WSOL_TOKEN_ADDRESS}`);
    console.log(`- BondingCurve: ${BONDING_CURVE_ADDRESS}`);
    console.log(`- Fee Percent: ${FEE_PERCENT} basis points`);
    
    const wsolToken = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WSOL_TOKEN_ADDRESS);
    const wsolMetadata = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WSOL_TOKEN_ADDRESS);
    const wsolDecimals = await wsolMetadata.decimals();
    console.log(`WSOL decimals: ${wsolDecimals}`);
    
    const TokenFactory = await ethers.getContractAt("TokenFactory", TOKEN_FACTORY_ADDRESS);
    
    // Get the signer
    const [deployer] = await ethers.getSigners();
    console.log(`Testing with account: ${deployer.address}`);
    
    const wsolBalance = await wsolToken.balanceOf(deployer.address);
    console.log(`WSOL balance: ${ethers.formatUnits(wsolBalance, wsolDecimals)} WSOL (${wsolBalance} raw units)`);
    
    // 1. Create a token
    console.log("\n1. Creating a token...");
    const createTx = await TokenFactory.createToken(TOKEN_NAME, TOKEN_SYMBOL);
    const createReceipt = await logTransaction(createTx, "Token creation transaction");
    
    const tokenCreatedEvents = await TokenFactory.queryFilter(
        TokenFactory.filters.TokenCreated(),
        createReceipt.blockNumber,
        createReceipt.blockNumber
    );
    
    if (tokenCreatedEvents.length === 0) {
        throw new Error("Failed to find TokenCreated event");
    }
    
    const newTokenAddress = tokenCreatedEvents[0].args.token;
    console.log(`Token created at: ${newTokenAddress}`);
    
    const tokenContract = await ethers.getContractAt("contracts/MemecoinLaunchpad/ERC20ForSplMintable.sol:ERC20ForSplMintable", newTokenAddress);
    
    // 2. First buy - partial funding (50% of funding goal)
    console.log("\n2. First buy - partial funding (50% of funding goal)...");
    
    // Calculate first buy amount (50% of funding goal)
    const buyAmount1 = FUNDING_GOAL_MULTIPLIER * FIRST_BUY_PERCENTAGE / 100n;
    console.log(`Buying with ${ethers.formatUnits(buyAmount1, wsolDecimals)} WSOL...`);

    // Approve and buy
    await logTransaction(
        await wsolToken.approve(TOKEN_FACTORY_ADDRESS, buyAmount1),
        "WSOL approval transaction"
    );
    
    await logTransaction(
        await TokenFactory.buy(newTokenAddress, buyAmount1),
        "First buy transaction"
    );
    
    // Check token state after first buy
    const tokenStateAfterFirstBuy = await TokenFactory.tokens(newTokenAddress);
    console.log(`Token state after first buy: ${tokenStateAfterFirstBuy} (should be FUNDING=${TokenState.FUNDING})`);
    
    const totalSupplyAfterFirstBuy = await tokenContract.totalSupply();
    console.log(`Total supply after first buy: ${ethers.formatUnits(totalSupplyAfterFirstBuy, TOKEN_DECIMALS)}`);
    
    // 3. Sell some tokens
    console.log("\n3. Selling tokens...");
    const sellAmount = totalSupplyAfterFirstBuy * BigInt(100) / SELL_PERCENTAGE; // Fix calculation
    console.log(`Selling ${ethers.formatUnits(sellAmount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}...`);
    
    // Approve and sell tokens
    await logTransaction(
        await tokenContract.approve(TOKEN_FACTORY_ADDRESS, sellAmount),
        "Token approval transaction"
    );
    
    await logTransaction(
        await TokenFactory.sell(newTokenAddress, sellAmount),
        "Sell transaction"
    );
    
    // Check collateral after sell
    const collateralAfterSell = await TokenFactory.collateral(newTokenAddress);
    console.log(`Collateral after sell: ${ethers.formatUnits(collateralAfterSell, wsolDecimals)} WSOL`);
    
    // 4. Final buy to reach funding goal
    console.log("\n4. Final buy to reach funding goal...");
    
    // Calculate remaining amount needed with buffer
    const remainingWsolNeeded = FUNDING_GOAL_MULTIPLIER - collateralAfterSell;
    const buyAmount2 = remainingWsolNeeded * FINAL_BUY_BUFFER / 100n;
    console.log(`Remaining WSOL needed: ${ethers.formatUnits(remainingWsolNeeded, wsolDecimals)} WSOL`);
    console.log(`Buying with ${ethers.formatUnits(buyAmount2, wsolDecimals)} WSOL (with ${FINAL_BUY_BUFFER - 100n}% buffer)...`);
    
    // Approve and buy
    await logTransaction(
        await wsolToken.approve(TOKEN_FACTORY_ADDRESS, buyAmount2),
        "WSOL approval for final buy"
    );
    
    await logTransaction(
        await TokenFactory.buy(newTokenAddress, buyAmount2),
        "Final buy transaction"
    );
    
    // Check final state
    const tokenState = await TokenFactory.tokens(newTokenAddress);
    
    if (tokenState === TokenState.TRADING) {
        console.log("Successfully reached funding goal and created liquidity pool!");
        const moraswapFactory = await ethers.getContractAt("IUniswapV2Factory", MORASWAP_FACTORY_ADDRESS);
        const pairAddress = await moraswapFactory.getPair(newTokenAddress, WSOL_TOKEN_ADDRESS);
        console.log(`Liquidity pool created at: ${pairAddress}`);
    } else {
        console.log("Failed to reach funding goal or create liquidity pool.");
        const collateralAfter = await TokenFactory.collateral(newTokenAddress);
        console.log(`Current collateral: ${ethers.formatUnits(collateralAfter, wsolDecimals)} WSOL`);
        console.log(`Funding goal: ${ethers.formatUnits(FUNDING_GOAL_MULTIPLIER, wsolDecimals)} WSOL`);
    }
    
    console.log("\n--- Testing Completed Successfully ---");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 