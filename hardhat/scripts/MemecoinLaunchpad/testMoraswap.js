const { ethers, run } = require("hardhat");

const NEON_EXPLORER_URL = "https://devnet.neonscan.org/tx/";
const MORASWAP_FACTORY_ADDRESS = "0x696d73D7262223724d60B2ce9d6e20fc31DfC56B";
const MORASWAP_ROUTER_ADDRESS = "0x491FFC6eE42FEfB4Edab9BA7D5F3e639959E081B";
const WSOL_TOKEN_ADDRESS = "0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c";
// Adjusted bonding curve parameters
const BONDING_CURVE_A = 10000000000000n; // Increase A to reduce initial token amount
const BONDING_CURVE_B = 1000000n; // Increase B for steeper price curve
const FEE_PERCENT = 100; // 1%
const TOKEN_DECIMALS = 9;

// Funding goal: 0.1 SOL
const FUNDING_GOAL_MULTIPLIER = 100000000n; // 0.1 SOL (0.1 * 10^9)
const REQUIRED_WSOL_MULTIPLIER = 200000000n; // 0.2 SOL (0.2 * 10^9)
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

// Helper function to verify contract
async function verifyContract(address, constructorArguments = []) {
    console.log(`Verifying contract at ${address}...`);
    try {
        await run("verify:verify", {
            address: address,
            constructorArguments: constructorArguments,
            network: "neonevm"
        });
        console.log(`Contract verified successfully: https://devnet.neonscan.org/address/${address}`);
    } catch (error) {
        console.error(`Verification failed:`, error.message);
    }
}

async function main() {
    console.log("Deploying MemecoinLaunchpad contracts...");

    console.log("Deploying ERC20ForSplMintable implementation...");
    const TokenImpl = await ethers.deployContract("contracts/MemecoinLaunchpad/ERC20ForSplMintable.sol:ERC20ForSplMintable");
    await TokenImpl.waitForDeployment();
    const tokenAddress = await TokenImpl.getAddress();
    console.log(`ERC20ForSplMintable implementation deployed to ${tokenAddress}`);
    
    // Verify ERC20ForSplMintable implementation
    await verifyContract(tokenAddress);

    console.log("Deploying BondingCurve...");
    const BondingCurve = await ethers.deployContract("BondingCurve", [BONDING_CURVE_A, BONDING_CURVE_B]);
    await BondingCurve.waitForDeployment();
    const bondingCurveAddress = await BondingCurve.getAddress();
    console.log(`BondingCurve deployed to ${bondingCurveAddress}`);
    
    // Verify BondingCurve
    await verifyContract(bondingCurveAddress, [BONDING_CURVE_A, BONDING_CURVE_B]);

    console.log("Using existing Moraswap contracts on neondevnet...");
    console.log(`WSOL token address: ${WSOL_TOKEN_ADDRESS}`);
    
    const wsolToken = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WSOL_TOKEN_ADDRESS);
    const wsolMetadata = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WSOL_TOKEN_ADDRESS);
    const wsolDecimals = await wsolMetadata.decimals();
    console.log(`WSOL decimals: ${wsolDecimals}`);
    
    const fundingGoal = FUNDING_GOAL_MULTIPLIER;
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
    
    // Verify TokenFactory
    await verifyContract(tokenFactoryAddress, [
        tokenAddress,
        MORASWAP_ROUTER_ADDRESS,
        MORASWAP_FACTORY_ADDRESS,
        bondingCurveAddress,
        WSOL_TOKEN_ADDRESS,
        FEE_PERCENT
    ]);

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
    
    // Add bytecode checking
    console.log("\nChecking contract bytecodes:");
    const implBytecode = await ethers.provider.getCode(tokenAddress);
    console.log(`Implementation bytecode length: ${implBytecode.length}`);
    console.log(`Implementation bytecode starts with: ${implBytecode.substring(0, 64)}...`);

    const cloneBytecode = await ethers.provider.getCode(newTokenAddress);
    console.log(`Clone bytecode length: ${cloneBytecode.length}`);
    console.log(`Clone bytecode: ${cloneBytecode}`);

    // Check if it matches EIP-1167 pattern
    const eip1167Prefix = "0x363d3d373d3d3d363d73";
    const eip1167Suffix = "5af43d82803e903d91602b57fd5bf3";
    const implAddressInHex = tokenAddress.substring(2).toLowerCase();
    const expectedProxyBytecode = `${eip1167Prefix}${implAddressInHex}${eip1167Suffix}`;
    console.log(`Expected EIP-1167 proxy bytecode: ${expectedProxyBytecode}`);
    const isEIP1167Proxy = cloneBytecode === expectedProxyBytecode;
    console.log(`Matches EIP-1167 pattern: ${isEIP1167Proxy}`);
    
    // Wait a bit before verification to ensure the contract is deployed
    console.log("Waiting for 10 seconds before verifying the token contract...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Only try to verify if it's not a standard EIP-1167 proxy
    if (!isEIP1167Proxy) {
        await verifyContract(newTokenAddress);
    } else {
        console.log(`
Note: The token contract at ${newTokenAddress} is a minimal proxy (EIP-1167) and cannot be verified directly.
This is expected behavior. The implementation contract at ${tokenAddress} has been verified.

To interact with this contract, you can use the ABI of the implementation contract.
You can view the contract on NeonScan: https://devnet.neonscan.org/address/${newTokenAddress}
        `);
    }
    
    const tokenContract = await ethers.getContractAt("contracts/MemecoinLaunchpad/ERC20ForSplMintable.sol:ERC20ForSplMintable", newTokenAddress);
    console.log(`Token name: ${await tokenContract.name()}`);
    console.log(`Token symbol: ${await tokenContract.symbol()}`);
    
    // 2. Buy tokens
    console.log("\n2. Buying tokens...");
    const buyAmount1 = FUNDING_GOAL_MULTIPLIER;
    console.log(`Buying with 0.1 WSOL (${ethers.formatUnits(buyAmount1, wsolDecimals)} WSOL)...`);

    // Add WSOL approval before buying
    console.log("Approving WSOL for TokenFactory...");
    await logTransaction(
        await wsolToken.approve(tokenFactoryAddress, buyAmount1),
        "WSOL approval transaction"
    );

    // Add debug logs for bonding curve calculation
    console.log("\nChecking bonding curve calculation...");
    try {
        const bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);
        const totalSupply = await tokenContract.totalSupply();
        console.log(`Current total supply: ${totalSupply}`);
        
        // Calculate expected tokens from bonding curve
        const expectedTokens = await bondingCurve.getAmountOut(totalSupply, buyAmount1);
        console.log(`Expected tokens from bonding curve: ${expectedTokens}`);
        
        // Check if within funding supply limit
        const fundingSupply = await TokenFactory.FUNDING_SUPPLY();
        console.log(`Funding supply limit: ${fundingSupply}`);
        console.log(`Available supply: ${fundingSupply - totalSupply}`);
        
        // Execute the buy transaction directly
        console.log("\nExecuting buy transaction...");
        const tx = await TokenFactory.buy(newTokenAddress, buyAmount1);
        console.log("Buy transaction sent, waiting for confirmation...");
        const receipt = await logTransaction(tx, "Buy transaction");
        console.log("Buy transaction confirmed!");

        // Add delay after transaction confirmation
        console.log("Waiting for state to settle...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check token state after buy
        console.log("\nChecking token state after buy:");
        const tokenState = await TokenFactory.tokens(newTokenAddress);
        console.log(`Token state: ${tokenState}`);
        const collateral = await TokenFactory.collateral(newTokenAddress);
        console.log(`Collateral: ${ethers.formatUnits(collateral, wsolDecimals)} WSOL`);
        
        // Check balances
        const userBalance = await tokenContract.balanceOf(deployer.address);
        console.log(`User token balance: ${ethers.formatUnits(userBalance, TOKEN_DECIMALS)}`);
        const userWsolBalance = await wsolToken.balanceOf(deployer.address);
        console.log(`User WSOL balance: ${ethers.formatUnits(userWsolBalance, wsolDecimals)} WSOL`);
        
    } catch (e) {
        console.error("\nDetailed error information:");
        console.error("Error message:", e.message);
        if (e.error) {
            console.error("Error details:", e.error);
            console.error("Error data:", e.error.data);
        }
        if (e.receipt) {
            console.error("Transaction receipt:", {
                status: e.receipt.status,
                logs: e.receipt.logs
            });
        }
        throw e;
    }
    
    // Check post-buy state
    const totalSupplyAfter = await tokenContract.totalSupply();
    console.log(`Total supply after buy: ${ethers.formatUnits(totalSupplyAfter, TOKEN_DECIMALS)}`);
    
    // 3. Sell some tokens
    console.log("\n3. Selling tokens...");
    const sellAmount = totalSupplyAfter / SELL_PERCENTAGE;
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