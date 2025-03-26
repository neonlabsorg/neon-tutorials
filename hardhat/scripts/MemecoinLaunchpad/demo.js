const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const {
    Raydium,
    TxVersion,
    DEVNET_PROGRAM_ID,
    DEV_LOCK_CPMM_PROGRAM,
    DEV_LOCK_CPMM_AUTH,
    getCpmmPdaAmmConfigId,
} = require("@raydium-io/raydium-sdk-v2");
const BN = require("bn.js");
const BLOCKSCOUT_EXPLORER_URL = "https://neon-devnet.blockscout.com/tx/";
const bs58 = require("bs58");
require('dotenv').config();
const { config } = require("../TestCallSolana/config.js");

// Utility function to generate a unique salt value based on timestamp
function generateUniqueSalt() {
    const timestamp = Date.now();
    const hexTimestamp = timestamp.toString(16).padStart(64, '0');
    return `0x${hexTimestamp}`;
}

// Load config
let localConfig;
try {
    const configPath = path.join(__dirname, "config.json");
    localConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("Loaded config file successfully");
} catch (error) {
    console.error("Failed to load config file:", error.message);
    console.log("Please run deploy.js first to generate the config file");
    process.exit(1);
}

const SOLANA_RPC_URL = localConfig.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new web3.Connection(SOLANA_RPC_URL, "processed");

const txVersion = TxVersion.LEGACY;

// Raydium SDK initialization function (similar to TestCreateRaydiumCpmmPool.js)
let raydium;
const initSdk = async (params = {}) => {
    if (raydium) return raydium;

    // Using payer from TokenFactory as owner for Raydium
    const TokenFactory = await ethers.getContractAt("TokenFactory", localConfig.TOKEN_FACTORY_ADDRESS);
    const payerHex = await TokenFactory.getPayer();
    const owner = new web3.PublicKey(ethers.encodeBase58(payerHex));

    raydium = await Raydium.load({
        owner,
        connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: !params.loadToken,
        blockhashCommitment: "finalized",
    });

    return raydium;
};

// Extract addresses from config
const {
    WSOL_TOKEN_ADDRESS,
    ERC20_FOR_SPL_FACTORY_ADDRESS,
    TOKEN_FACTORY_ADDRESS,
    BONDING_CURVE_ADDRESS,
    FEE_PERCENT
} = localConfig;

// Funding goal: 0.1 SOL
const FUNDING_GOAL_MULTIPLIER = 100000000n; // 0.1 SOL (0.1 * 10^9)
const BUY_BUFFER = 120n; // 20% buffer to ensure we reach the goal
// Add timestamp to token name to avoid collisions
const timestamp = Date.now();
const TOKEN_NAME = `NeonMeme${timestamp}`;
const TOKEN_SYMBOL = `NM${timestamp.toString().slice(-4)}`;

// Enum to match TokenFactory.sol's TokenState enum
const TokenState = {
    NOT_CREATED: 0n,
    FUNDING: 1n,
    TRADING: 2n
};

// Helper function to log transaction with explorer link
async function logTransaction(tx, description) {
    const receipt = await tx.wait();
    console.log(`✅ ${description}: ${BLOCKSCOUT_EXPLORER_URL}${tx.hash}`);
    return receipt;
}

// Helper function to create ATAs directly via Solana Web3.js
async function createATAsForPayer(connection, payerBase58, tokenMints) {
    console.log("\n🔑 Creating Associated Token Accounts...");
    let keypair;
    try {
        if (process.env.ANCHOR_WALLET === undefined) {
            throw new Error("Please set ANCHOR_WALLET environment variable to point to your id.json file");
        }

        const secretKeyArray = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET).toString());
        keypair = web3.Keypair.fromSecretKey(
            Uint8Array.from(secretKeyArray)
        );
    } catch (error) {
        console.error("❌ Error loading keypair:", error);
        throw error;
    }

    const payerPublicKey = new web3.PublicKey(payerBase58);
    const transaction = new web3.Transaction();
    let atasToBeCreated = "";

    // Check and create ATAs for each token mint
    for (let i = 0, len = tokenMints.length; i < len; ++i) {
        const associatedToken = getAssociatedTokenAddressSync(
            new web3.PublicKey(tokenMints[i]),
            payerPublicKey,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const ataInfo = await connection.getAccountInfo(associatedToken);

        if (!ataInfo || !ataInfo.data) {
            atasToBeCreated += tokenMints[i] + ", ";

            transaction.add(
                createAssociatedTokenAccountInstruction(
                    keypair.publicKey,
                    associatedToken,
                    payerPublicKey,
                    new web3.PublicKey(tokenMints[i]),
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
        }
    }

    if (transaction.instructions.length) {
        try {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;

            await web3.sendAndConfirmTransaction(
                connection,
                transaction,
                [keypair],
                {
                    skipPreflight: false,
                    maxRetries: 3,
                    commitment: 'confirmed'
                }
            );
        } catch (error) {
            console.error("❌ Failed to create Associated Token Accounts:", error);
            throw error;
        }
    } else {
        return console.error("\n❌ No instructions included into transaction.");
    }

    const fundingTokenATA = getAssociatedTokenAddressSync(
        new web3.PublicKey(tokenMints[0]),
        payerPublicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const fundingTokenATABytes32 = config.utils.publicKeyToBytes32(fundingTokenATA.toString());

    const memeTokenATA = getAssociatedTokenAddressSync(
        new web3.PublicKey(tokenMints[1]),
        payerPublicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const memeTokenATABytes32 = config.utils.publicKeyToBytes32(memeTokenATA.toString());
    console.log(`\n📝 Associated Token Accounts created:`);
    console.log(`   Meme Token ATA: ${memeTokenATABytes32}`);
    console.log(`   Funding Token ATA: ${fundingTokenATABytes32}`);

    return {
        fundingTokenATABytes32,
        memeTokenATABytes32
    };
}

// Helper function to build Raydium pool creation instructions
async function buildPoolCreationInstructions(raydiumWithTokens, payerBase58, newTokenMint, wsolTokenMint) {
    const mintA = await raydiumWithTokens.token.getTokenInfo(newTokenMint);
    const mintB = await raydiumWithTokens.token.getTokenInfo(wsolTokenMint);

    const feeConfigs = await raydiumWithTokens.api.getCpmmConfigs();
    if (raydiumWithTokens.cluster === "devnet") {
        feeConfigs.forEach((configItem) => {
            configItem.id = getCpmmPdaAmmConfigId(
                DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                configItem.index
            ).publicKey.toBase58();
        });
    }

    const createPoolArgs = {
        programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
        poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
        mintA,
        mintB,
        mintAAmount: new BN(200000000000000),
        mintBAmount: new BN(103000000),
        startTime: new BN(0),
        feeConfig: feeConfigs[0],
        associatedOnly: false,
        ownerInfo: {
            useSOLBalance: true,
        },
        feePayer: new web3.PublicKey(payerBase58),
        txVersion,
    };

    await raydiumWithTokens.account.fetchWalletTokenAccounts();

    const instructionBuilderForCreatePool = await raydiumWithTokens.cpmm.createPool(createPoolArgs);

    instructionBuilderForCreatePool.builder.instructions[2].keys[0] = {
        pubkey: new web3.PublicKey(payerBase58),
        isSigner: true,
        isWritable: true,
    };

    const solanaTx = new web3.Transaction();
    solanaTx.add(instructionBuilderForCreatePool.builder.instructions[0]);
    solanaTx.add(instructionBuilderForCreatePool.builder.instructions[1]);
    solanaTx.add(instructionBuilderForCreatePool.builder.instructions[2]);

    const instructions = solanaTx.instructions.map(instruction => {
        return config.utils.prepareInstruction(instruction);
    });

    return {
        instructions,
        poolId: instructionBuilderForCreatePool.builder.instructions[2].keys[3].pubkey
    };
}

async function main() {
    console.log("\n🚀 Initializing Raydium SDK...");
    const raydium = await initSdk();
    console.log("🧪 Testing MemecoinLaunchpad contracts with Raydium integration...");

    const wsolToken = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WSOL_TOKEN_ADDRESS);
    const wsolMetadata = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", WSOL_TOKEN_ADDRESS);
    const wsolDecimals = await wsolMetadata.decimals();

    const TokenFactory = await ethers.getContractAt("TokenFactory", TOKEN_FACTORY_ADDRESS);
    const [deployer] = await ethers.getSigners();

    const wsolBalance = await wsolToken.balanceOf(deployer.address);
    console.log(`💰 WSOL balance: ${ethers.formatUnits(wsolBalance, wsolDecimals)} WSOL`);

    // 1. Create a token
    console.log("\n📝 Step 1: Creating a token...");
    const createTx = await TokenFactory.createToken(TOKEN_NAME, TOKEN_SYMBOL);
    const createReceipt = await logTransaction(createTx, "Token creation");

    const tokenCreatedEvents = await TokenFactory.queryFilter(
        TokenFactory.filters.TokenCreated(),
        createReceipt.blockNumber,
        createReceipt.blockNumber
    );

    if (tokenCreatedEvents.length === 0) {
        throw new Error("Failed to find TokenCreated event");
    }

    const newTokenAddress = tokenCreatedEvents[0].args.token;
    console.log(`✅ Token created at: ${newTokenAddress}`);

    const tokenContract = await ethers.getContractAt("contracts/MemecoinLaunchpad/interfaces/IERC20.sol:IERC20", newTokenAddress);

    const payer = await TokenFactory.getPayer();
    const payerBase58 = ethers.encodeBase58(payer);

    const wsolTokenMint = localConfig.TOKENS.WSOL_MINT;
    const newTokenMintHex = await tokenContract.tokenMint();
    const newTokenMint = ethers.encodeBase58(newTokenMintHex);

    try {
        const tokenMints = [wsolTokenMint, newTokenMint];
        const { fundingTokenATABytes32, memeTokenATABytes32 } = await createATAsForPayer(connection, payerBase58, tokenMints);

        const raydiumWithTokens = await initSdk({ loadToken: true });
        await raydiumWithTokens.account.fetchWalletTokenAccounts();

        // Build instructions once to reuse
        const { instructions, poolId } = await buildPoolCreationInstructions(raydiumWithTokens, payerBase58, newTokenMint, wsolTokenMint);
        const lamports = [500000000, 0, 1500000000];
        const saltValues = [ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash];

        // 2. First buy - small amount that won't reach funding goal
        console.log("\n💰 Step 2: First buy - small amount...");
        const smallBuyAmount = FUNDING_GOAL_MULTIPLIER / 4n; // 0.025 SOL
        console.log(`   Amount: ${ethers.formatUnits(smallBuyAmount, wsolDecimals)} WSOL`);

        await logTransaction(
            await wsolToken.approve(TOKEN_FACTORY_ADDRESS, smallBuyAmount),
            "WSOL approval"
        );

        await logTransaction(
            await TokenFactory.buy(newTokenAddress, smallBuyAmount,
                { lamports: lamports, salt: saltValues, instruction: instructions },
                { fundingTokenATA: fundingTokenATABytes32, memeTokenATA: memeTokenATABytes32 }),
            "First buy"
        );

        // 3. Sell some tokens
        console.log("\n💰Step 3: Selling some tokens...");
        const tokenBalance = await tokenContract.balanceOf(deployer.address);
        const sellAmount = tokenBalance / 2n; // Sell half of the tokens
        console.log(`   Amount: ${ethers.formatUnits(sellAmount, await tokenContract.decimals())} tokens`);

        await logTransaction(
            await tokenContract.approve(TOKEN_FACTORY_ADDRESS, sellAmount),
            "Token approval"
        );

        await logTransaction(
            await TokenFactory.sell(newTokenAddress, sellAmount),
            "Sell"
        );

        // 4. Final buy to reach funding goal and create Raydium pool
        console.log("\n🚀 Step 4: Final buy to reach funding goal and create Raydium pool...");
        const remainingAmount = FUNDING_GOAL_MULTIPLIER * BUY_BUFFER / 100n;
        console.log(`   Amount: ${ethers.formatUnits(remainingAmount, wsolDecimals)} WSOL (with ${BUY_BUFFER - 100n}% buffer)`);

        await logTransaction(
            await wsolToken.approve(TOKEN_FACTORY_ADDRESS, remainingAmount),
            "WSOL approval"
        );

        await logTransaction(
            await TokenFactory.buy(newTokenAddress, remainingAmount,
                { lamports: lamports, salt: saltValues, instruction: instructions },
                { fundingTokenATA: fundingTokenATABytes32, memeTokenATA: memeTokenATABytes32 }),
            "Final buy with Raydium pool creation"
        );

        //*************************** LOCK LIQUIDITY *********************************/
        console.log("\n🔒 Step 5: Locking liquidity...");

        const salt = generateUniqueSalt();
        console.log(`   Generated unique salt: ${salt}`);
        const externalAuthority = ethers.encodeBase58(await TokenFactory.getExtAuthority(salt));

        let poolInfo;
        let poolKeys;
        if (raydium.cluster === "mainnet") {
            const data = await raydium.api.fetchPoolById({ ids: poolId });
            poolInfo = data[0];
            if (!isValidCpmm(poolInfo.programId))
                throw new Error("Target pool is not CPMM pool");
        } else {
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
            poolInfo = data.poolInfo;
            poolKeys = data.poolKeys;
        }

        await raydium.account.fetchWalletTokenAccounts();
        const lpBalance = raydium.account.tokenAccounts.find(
            (a) => a.mint.toBase58() === poolInfo.lpMint.address
        );
        if (!lpBalance) throw new Error(`You do not have balance in pool: ${poolId}`);

        const instructionBuilderForLockingLiquidity = await raydium.cpmm.lockLp({
            programId: DEV_LOCK_CPMM_PROGRAM,
            authProgram: DEV_LOCK_CPMM_AUTH,
            poolKeys,
            poolInfo,
            feePayer: new web3.PublicKey(payerBase58),
            lpAmount: lpBalance.amount,
            withMetadata: true,
            txVersion,
            getEphemeralSigners: async (k) => {
                return new Array(k).fill(new web3.PublicKey(externalAuthority));
            },
        });

        instructionBuilderForLockingLiquidity.builder.instructions[0].keys[2].isWritable = true;
        instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isSigner = true;
        instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isWritable = true;

        console.log("   Preparing lock liquidity instruction...");
        const instruction = config.utils.prepareInstruction(instructionBuilderForLockingLiquidity.builder.instructions[0]);
        console.log("   Executing lock liquidity transaction...");
        const tx = await TokenFactory.execute(
            1000000000,
            salt,
            instruction
        );

        await logTransaction(tx, "Lock liquidity");

        const tokenState = await TokenFactory.tokens(newTokenAddress);

        if (tokenState === TokenState.TRADING) {
            console.log("\n🎉 Success! Token launch completed:");
            console.log(`   Token address: ${newTokenAddress}`);
            console.log(`   Raydium pool created:`);
            console.log(`     Token A (new token): ${newTokenMint}`);
            console.log(`     Token B (WSOL): ${wsolTokenMint}`);
        } else {
            console.log("\n❌ Failed to reach funding goal or create liquidity pool.");
            const collateralAfter = await TokenFactory.collateral(newTokenAddress);
            console.log(`   Current collateral: ${ethers.formatUnits(collateralAfter, wsolDecimals)} WSOL`);
            console.log(`   Funding goal: ${ethers.formatUnits(FUNDING_GOAL_MULTIPLIER, wsolDecimals)} WSOL`);
        }

    } catch (err) {
        console.error("❌ Error during Raydium pool setup:", err);
        throw err;
    }

    console.log("\n✨ Testing Completed Successfully ✨");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});