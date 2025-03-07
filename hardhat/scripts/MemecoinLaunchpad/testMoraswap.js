const { ethers } = require("hardhat");

const NEON_EXPLORER_URL = "https://devnet.neonscan.org/tx/";
const MORASWAP_FACTORY_ADDRESS = "0x696d73D7262223724d60B2ce9d6e20fc31DfC56B";
const MORASWAP_ROUTER_ADDRESS = "0x491FFC6eE42FEfB4Edab9BA7D5F3e639959E081B";
const WSOL_TOKEN_ADDRESS = "0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c";
const BONDING_CURVE_A = 16319324419n;
const BONDING_CURVE_B = 1000000000n;
const FEE_PERCENT = 100; // 1%
const FUNDING_GOAL_MULTIPLIER = 1n; // 0.1 WSOL (1 * 10^(decimals-1))
const REQUIRED_WSOL_MULTIPLIER = 2n; // 0.2 WSOL (2 * 10^(decimals-1))
const FEE_BUFFER_PERCENT = 110n; // 10% buffer
const TOKEN_NAME = "Neon Meme Token";
const TOKEN_SYMBOL = "NMEME";
const SELL_PERCENTAGE = 10n; // Sell 10% of tokens

// Enum to match TokenFactory.sol's TokenState enum
const TokenState = {
    NOT_CREATED: 0n,
    FUNDING: 1n,
    TRADING: 2n
};


// Helper function to log transaction with explorer link
// returns the transaction receipt
async function logTransaction(tx, description) {
    const receipt = await tx.wait();
    console.log(`${description}: ${NEON_EXPLORER_URL}${tx.hash}`);
    return receipt;
}

async function main() {
    console.log("Deploying MemecoinLaunchpad contracts...");

    console.log("Deploying Token implementation...");
    const Token = await ethers.deployContract("Token");
    await Token.waitForDeployment();
    const tokenAddress = await Token.getAddress();
    console.log(`Token implementation deployed to ${tokenAddress}`);

    console.log("Deploying BondingCurve...");
    const BondingCurve = await ethers.deployContract("BondingCurve", [BONDING_CURVE_A, BONDING_CURVE_B]);
    await BondingCurve.waitForDeployment();
    const bondingCurveAddress = await BondingCurve.getAddress();
    console.log(`BondingCurve deployed to ${bondingCurveAddress}`);

    console.log("Using existing Moraswap contracts on neondevnet...");
    console.log(`WSOL token address: ${WSOL_TOKEN_ADDRESS}`);
    
    const wsolToken = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WSOL_TOKEN_ADDRESS);
    const wsolMetadata = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WSOL_TOKEN_ADDRESS);
    const wsolDecimals = await wsolMetadata.decimals();
    console.log(`WSOL decimals: ${wsolDecimals}`);
    
    const fundingGoal = FUNDING_GOAL_MULTIPLIER * 10n ** BigInt(Number(wsolDecimals) - 1);
    console.log(`Funding goal: 0.1 WSOL (${fundingGoal} in raw units)`);
    
    // Deploy TokenFactory
    console.log("Deploying TokenFactory...");
    const TokenFactory = await ethers.deployContract("TokenFactory", [
        tokenAddress,
        MORASWAP_ROUTER_ADDRESS,
        MORASWAP_FACTORY_ADDRESS,
        bondingCurveAddress,
        WSOL_TOKEN_ADDRESS,
        FEE_PERCENT
    ]);
    await TokenFactory.waitForDeployment();
    const tokenFactoryAddress = await TokenFactory.getAddress();
    console.log(`TokenFactory deployed to ${tokenFactoryAddress}`);
    console.log("\n--- Testing Functionality ---");
    
    // Get the signer
    const [deployer] = await ethers.getSigners();
    console.log(`Testing with account: ${deployer.address}`);
    
    const wsolBalance = await wsolToken.balanceOf(deployer.address);
    console.log(`WSOL balance: ${ethers.formatUnits(wsolBalance, wsolDecimals)} WSOL (${wsolBalance} raw units)`);
    
    // 1. Create a token
    console.log("\n1. Creating a token...");
    const createTx = await TokenFactory.createToken(TOKEN_NAME, TOKEN_SYMBOL);
    const createReceipt = await logTransaction(createTx, "Token creation transaction");
    
    // Get the token address using ethers v6 filters
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
    
    const tokenContract = await ethers.getContractAt("Token", newTokenAddress);
    console.log(`Token name: ${await tokenContract.name()}`);
    console.log(`Token symbol: ${await tokenContract.symbol()}`);
    
    // 2. Buy tokens
    console.log("\n2. Buying tokens...");
    const buyAmount1 = FUNDING_GOAL_MULTIPLIER * 10n ** BigInt(Number(wsolDecimals) - 1);
    console.log(`Buying with 0.1 WSOL (${ethers.formatUnits(buyAmount1, wsolDecimals)} WSOL)...`);
    
    // Approve and buy tokens
    await logTransaction(
        await wsolToken.approve(tokenFactoryAddress, buyAmount1),
        "WSOL approval transaction"
    );
    console.log("WSOL approved for TokenFactory");
    
    const balanceBefore = await tokenContract.balanceOf(deployer.address);
    console.log(`Balance before: ${ethers.formatEther(balanceBefore)} ${TOKEN_SYMBOL}`);
    
    await logTransaction(
        await TokenFactory.buy(newTokenAddress, buyAmount1),
        "Buy transaction"
    );
    
    const balanceAfter1 = await tokenContract.balanceOf(deployer.address);
    console.log(`Balance after: ${ethers.formatEther(balanceAfter1)} ${TOKEN_SYMBOL}`);
    console.log(`Tokens received: ${ethers.formatEther(balanceAfter1 - balanceBefore)} ${TOKEN_SYMBOL}`);
    
    // 3. Sell some tokens
    console.log("\n3. Selling tokens...");
    const sellAmount = balanceAfter1 / SELL_PERCENTAGE;
    console.log(`Selling ${ethers.formatEther(sellAmount)} ${TOKEN_SYMBOL}...`);
    
    // Approve and sell tokens
    await logTransaction(
        await tokenContract.approve(tokenFactoryAddress, sellAmount),
        "Token approval transaction"
    );
    
    const wsolBalanceBefore = await wsolToken.balanceOf(deployer.address);
    
    await logTransaction(
        await TokenFactory.sell(newTokenAddress, sellAmount),
        "Sell transaction"
    );
    
    const balanceAfter2 = await tokenContract.balanceOf(deployer.address);
    const wsolBalanceAfter = await wsolToken.balanceOf(deployer.address);
    
    console.log(`Balance after selling: ${ethers.formatEther(balanceAfter2)} ${TOKEN_SYMBOL}`);
    console.log(`WSOL received: ${ethers.formatUnits(wsolBalanceAfter - wsolBalanceBefore, wsolDecimals)} WSOL (${wsolBalanceAfter - wsolBalanceBefore} raw units)`);
    
    // 4. Buy more tokens to reach funding goal
    console.log("\n4. Buying more tokens to reach funding goal...");
    
    const collateralBefore = await TokenFactory.collateral(newTokenAddress);
    console.log(`Current collateral: ${ethers.formatUnits(collateralBefore, wsolDecimals)} WSOL (${collateralBefore} raw units)`);
    const remainingWsolNeeded = fundingGoal - collateralBefore;
    
    const buyAmount2 = remainingWsolNeeded * FEE_BUFFER_PERCENT / 100n;
    console.log(`Remaining WSOL needed: ${ethers.formatUnits(remainingWsolNeeded, wsolDecimals)} WSOL (${remainingWsolNeeded} raw units)`);
    console.log(`Buying with ${ethers.formatUnits(buyAmount2, wsolDecimals)} WSOL (${buyAmount2} raw units) (including fee buffer)...`);
    
    await logTransaction(
        await wsolToken.approve(tokenFactoryAddress, buyAmount2),
        "WSOL approval transaction"
    );
    console.log("WSOL approved for TokenFactory");
    
    await logTransaction(
        await TokenFactory.buy(newTokenAddress, buyAmount2),
        "Buy transaction"
    );
    
    const tokenState = await TokenFactory.tokens(newTokenAddress);
    
    if (tokenState === TokenState.TRADING) {
        console.log("Successfully reached funding goal and created liquidity pool!");
                const moraswapFactory = await ethers.getContractAt("IUniswapV2Factory", MORASWAP_FACTORY_ADDRESS);
        const pairAddress = await moraswapFactory.getPair(newTokenAddress, WSOL_TOKEN_ADDRESS);
        console.log(`Liquidity pool created at: ${pairAddress}`);
    } else {
        console.log("Failed to reach funding goal or create liquidity pool.");
        const collateralAfter = await TokenFactory.collateral(newTokenAddress);
        console.log(`Current collateral: ${ethers.formatUnits(collateralAfter, wsolDecimals)} WSOL (${collateralAfter} raw units)`);
        console.log(`Funding goal: ${ethers.formatUnits(fundingGoal, wsolDecimals)} WSOL (${fundingGoal} raw units)`);
    }
    
    // 5. Claim fee (owner only)
    console.log("\n5. Claiming fee...");
    const feeAmount = await TokenFactory.fee();
    console.log(`Fee amount: ${ethers.formatUnits(feeAmount, wsolDecimals)} WSOL (${feeAmount} raw units)`);
    
    await logTransaction(
        await TokenFactory.claimFee(),
        "Claim fee transaction"
    );
    
    const feeAfter = await TokenFactory.fee();
    console.log(`Fee after claiming: ${ethers.formatUnits(feeAfter, wsolDecimals)} WSOL (${feeAfter} raw units)`);
    const ownerWsolBalanceAfter = await wsolToken.balanceOf(deployer.address);
    console.log(`Owner WSOL balance after claiming fee: ${ethers.formatUnits(ownerWsolBalanceAfter, wsolDecimals)} WSOL`);
    
    console.log("\n--- Testing Completed Successfully ---");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 