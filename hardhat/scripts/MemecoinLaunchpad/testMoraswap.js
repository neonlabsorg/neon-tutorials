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
  getCpmmPdaAmmConfigId,
} = require("@raydium-io/raydium-sdk-v2");
const BN = require("bn.js");
const BLOCKSCOUT_EXPLORER_URL = "https://neon-devnet.blockscout.com/tx/";
const bs58 = require("bs58");
require('dotenv').config();
const { config } = require("../../scripts/TestCallSolana/config.js");

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

// Raydium constants
const RAYDIUM_CREATE_CPMM_POOL_PROGRAM = localConfig.RAYDIUM.CREATE_CPMM_POOL_PROGRAM;
const RAYDIUM_CREATE_CPMM_POOL_FEE_ACC = localConfig.RAYDIUM.CREATE_CPMM_POOL_FEE_ACC;
const RAYDIUM_DEV_LOCK_CPMM_PROGRAM = localConfig.RAYDIUM.DEV_LOCK_CPMM_PROGRAM;
const RAYDIUM_DEV_LOCK_CPMM_AUTH = localConfig.RAYDIUM.DEV_LOCK_CPMM_AUTH;

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
    console.log(`${description}: ${BLOCKSCOUT_EXPLORER_URL}${tx.hash}`);
    return receipt;
}


// Helper function to create ATAs directly via Solana Web3.js
async function createATAsForPayer(connection, payerBase58, tokenMints) {
    console.log("\nCreating ATAs directly via Solana Web3.js...");
    let keypair;
    try {
        if (process.env.ANCHOR_WALLET === undefined) {
            throw new Error("Please set ANCHOR_WALLET environment variable to point to your id.json file");
        }
        
        console.log(`Loading keypair from ${process.env.ANCHOR_WALLET}`);
        const secretKeyArray = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET).toString());
        keypair = web3.Keypair.fromSecretKey(
            Uint8Array.from(secretKeyArray)
        );
        console.log(`Using keypair with public key: ${keypair.publicKey.toString()}`);
    } catch (error) {
        console.error("Error loading keypair:", error);
        throw error;
    }
    console.log(keypair.publicKey.toString(), "keypair pubkey");

    const payerPublicKey = new web3.PublicKey(payerBase58);
    console.log(`Target payer public key: ${payerPublicKey.toString()}`);
  
    
    const transaction = new web3.Transaction();
    let atasToBeCreated = "";

    // Check and create ATAs for each token mint
    for (let i = 0, len = tokenMints.length; i < len; ++i) {
        console.log(`Processing funding token mint: ${tokenMints[i]}`);

        const associatedToken = getAssociatedTokenAddressSync(
          new web3.PublicKey(tokenMints[i]),
          payerPublicKey,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const ataInfo = await connection.getAccountInfo(associatedToken);

        // create ATA only if it's missing
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
        console.log(
          "\nCreating ATA accounts for the following SPLTokens - ",
          atasToBeCreated.substring(0, atasToBeCreated.length - 2)
        );
        const signature = await web3.sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair]
        );
    
        console.log("\nTx signature", signature);
      } else {
        return console.error("\nNo instructions included into transaction.");
    }

    const fundingTokenATA =getAssociatedTokenAddressSync(
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
    console.log(memeTokenATA.toString(), "memeTokenATA");
    console.log(memeTokenATABytes32, "memeTokenATABytes32");
    console.log(fundingTokenATA.toString(), "fundingTokenATA");
    console.log(fundingTokenATABytes32, "fundingTokenATABytes32");

    return {
        fundingTokenATABytes32,
        memeTokenATABytes32
    };

}

async function main() {
    // Initialize Raydium SDK
    console.log("\nInitializing Raydium SDK...");
    const raydium = await initSdk();
    console.log("Raydium SDK initialized successfully");
    console.log("Testing MemecoinLaunchpad contracts with Raydium integration...");

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
    console.log(`Creating token with name: ${TOKEN_NAME} and symbol: ${TOKEN_SYMBOL}`);
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
    
    // Get the payer address from the CallSolana contract
    const payer = await TokenFactory.getPayer();
    console.log(`Payer address (hex): ${payer}`);
    const payerBase58 = ethers.encodeBase58(payer);
    console.log(`Payer address (base58): ${payerBase58}`);
    
    // Get token mint addresses
    const wsolTokenMint = localConfig.TOKENS.WSOL_MINT;
    console.log(`WSOL token mint: ${wsolTokenMint}`);
    
    const newTokenMintHex = await tokenContract.tokenMint();
    const newTokenMint = ethers.encodeBase58(newTokenMintHex);
    console.log(`New token mint (hex): ${newTokenMintHex}`);
    console.log(`New token mint (base58): ${newTokenMint}`);
    
    // 2. Buy directly with full funding goal (plus buffer)
    console.log("\n2. Buy to reach funding goal and create Raydium pool...");
    
    // Calculate buy amount (full funding goal + buffer)
    const buyAmount = FUNDING_GOAL_MULTIPLIER * BUY_BUFFER / 100n;
    console.log(`Buying with ${ethers.formatUnits(buyAmount, wsolDecimals)} WSOL (with ${BUY_BUFFER - 100n}% buffer)...`);
    
    // Approve WSOL for buy
    await logTransaction(
        await wsolToken.approve(TOKEN_FACTORY_ADDRESS, buyAmount),
        "WSOL approval for buy"
    );
    
    // Create Raydium pool creation instructions
    // Following the approach in TestCreateRaydiumCpmmPool.js

    // Use the specific salt from TestCreateRaydiumCpmmPool.js
    const salt = "0x000000000000000000000000000000000000000000000000000000000000014d";
    const externalAuthority = ethers.encodeBase58(await TokenFactory.getExtAuthority(salt));
    console.log(`External authority (base58): ${externalAuthority}`);

    try {
        // Create ATAs for the token mints
        const tokenMints = [wsolTokenMint, newTokenMint];
        const { fundingTokenATABytes32, memeTokenATABytes32 } = await createATAsForPayer(connection, payerBase58, tokenMints);
        console.log("ATA creation complete");
        
        // Initialize or re-initialize Raydium with token loading
        console.log("Initializing Raydium SDK with token loading enabled...");
        const raydiumWithTokens = await initSdk({ loadToken: true });
        console.log("Raydium SDK initialized with token loading");
        
        // Fetch token accounts to verify ATAs
        console.log("\nFetching token accounts to verify ATAs...");
        await raydiumWithTokens.account.fetchWalletTokenAccounts();
        console.log(`Found ${raydiumWithTokens.account.tokenAccounts.length} token accounts`);
        
        if (raydiumWithTokens.account.tokenAccounts.length > 0) {
            for (const account of raydiumWithTokens.account.tokenAccounts) {
                console.log(`Token account: ${account.publicKey.toString()}, mint: ${account.mint.toString()}`);
            }
        }

        // Get token info for using with Raydium SDK
        console.log("\nGetting token info for Raydium integration...");
        const mintA = await raydiumWithTokens.token.getTokenInfo(newTokenMint);
        const mintB = await raydiumWithTokens.token.getTokenInfo(wsolTokenMint);
        console.log("Token info retrieved successfully");

        // Get fee configs from Raydium
        const feeConfigs = await raydiumWithTokens.api.getCpmmConfigs();
        if (raydiumWithTokens.cluster === "devnet") {
            feeConfigs.forEach((configItem) => {
                configItem.id = getCpmmPdaAmmConfigId(
                    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                    configItem.index
                ).publicKey.toBase58();
            });
        }
        console.log("Fee configs retrieved successfully");
        console.log("First fee config:", feeConfigs[0]);

        // Log the token info before passing to createPool
        console.log("\nToken mintA info:", {
            address: mintA.address,
            decimals: mintA.decimals,
            isToken2022: mintA.isToken2022
        });
        console.log("Token mintB info:", {
            address: mintB.address,
            decimals: mintB.decimals,
            isToken2022: mintB.isToken2022
        });

        console.log("\nPayer public key:", payerBase58);
        console.log("CREATE_CPMM_POOL_PROGRAM:", DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM);
        console.log("CREATE_CPMM_POOL_FEE_ACC:", DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC);
        console.log("mintAAmount:", new BN(200000000000000).toString());
        console.log("mintBAmount:", new BN(100000000).toString());
        console.log("startTime:", new BN(0).toString());
        console.log("associatedOnly:", false);
        console.log("useSOLBalance:", true);
        console.log("txVersion:", txVersion);
        
        // Create pool instructions using Raydium SDK (as in TestCreateRaydiumCpmmPool.js)
        console.log("\nCreating pool instructions using Raydium SDK...");
        const createPoolArgs = {
            programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, 
            poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
            mintA,
            mintB,
            mintAAmount: new BN(200000000000000), // MEME TOKEN
            mintBAmount: new BN(103000000), //WSOL
            startTime: new BN(0),
            feeConfig: feeConfigs[0],
            associatedOnly: false,
            ownerInfo: {
                useSOLBalance: true,
            },
            feePayer: new web3.PublicKey(payerBase58),
            txVersion,
        };
        
        console.log("createPoolArgs:", JSON.stringify(createPoolArgs, (key, value) => 
            value instanceof BN ? value.toString() : 
            value instanceof web3.PublicKey ? value.toString() : 
            value, 2));
            
        // Load token accounts for the owner before calling createPool
        console.log("\nLoading token accounts...");
        await raydiumWithTokens.account.fetchWalletTokenAccounts();
        console.log("Token accounts loaded. Count:", raydiumWithTokens.account.tokenAccounts.length);
        if (raydiumWithTokens.account.tokenAccounts.length > 0) {
            console.log("First token account:", {
                mint: raydiumWithTokens.account.tokenAccounts[0].mint.toString(),
                amount: raydiumWithTokens.account.tokenAccounts[0].amount.toString()
            });
        }
        
        const instructionBuilderForCreatePool = await raydiumWithTokens.cpmm.createPool(createPoolArgs);
        console.log("Pool instructions created successfully");
        console.log("Extra info:", instructionBuilderForCreatePool.extInfo);

        // Make the payer account writable (as in TestCreateRaydiumCpmmPool.js)
        instructionBuilderForCreatePool.builder.instructions[2].keys[0] = {
            pubkey: new web3.PublicKey(payerBase58),
            isSigner: true,
            isWritable: true,
        };

        console.log(
            instructionBuilderForCreatePool.builder.instructions[0],
            "Create Account"
        );
        console.log(
            instructionBuilderForCreatePool.builder.instructions[1],
            "Init Account"
        );
        console.log(
            instructionBuilderForCreatePool.builder.instructions[2],
            "Cpmm Create Pool"
        );

        // Build transaction with all instructions
        console.log("\nBroadcast creating pool transaction...");
        const solanaTx = new web3.Transaction();
        solanaTx.add(instructionBuilderForCreatePool.builder.instructions[0]);
        solanaTx.add(instructionBuilderForCreatePool.builder.instructions[1]);
        solanaTx.add(instructionBuilderForCreatePool.builder.instructions[2]);
        
        // Before the map function that serializes instructions
        console.log("\n=== RAW INSTRUCTIONS BEFORE SERIALIZATION ===");
        solanaTx.instructions.forEach((instruction, i) => {
            console.log(`\nInstruction ${i}:`);
            console.log(`  Program ID: ${instruction.programId.toString()}`);
            
            console.log("  Keys:");
            instruction.keys.forEach((key, j) => {
                console.log(`    Key ${j}: ${key.pubkey.toString()}`);
                console.log(`      isSigner: ${key.isSigner}, isWritable: ${key.isWritable}`);
            });
            
            console.log(`  Data length: ${instruction.data.length}`);
            console.log(`  Data (hex): ${Buffer.from(instruction.data).toString('hex').substring(0, 100)}${instruction.data.length > 50 ? '...' : ''}`);
        });

        // Extract the serialized instructions
        const instructions = solanaTx.instructions.map(instruction => {
            return config.utils.prepareInstruction(instruction);
        });

        // After serializing the instructions
        console.log("\n=== SERIALIZED INSTRUCTIONS ===");
        instructions.forEach((instruction, i) => {
            console.log(`\nSerialized Instruction ${i}:`);
            console.log(`  Length: ${instruction.length}`);
            console.log(`  Value: ${instruction.substring(0, 100)}${instruction.length > 100 ? '...' : ''}`);
        });

        // Prepare lamports and salt values (matching TestCreateRaydiumCpmmPool.js)
        const lamports = [500000000, 0, 1500000000];
        const saltValues = [ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash];

        console.log("Prepared parameters for buy:");
        console.log("Instruction count:", instructions.length);
        console.log("Lamports:", lamports);
        console.log("Salt values:", saltValues.map(s => typeof s === 'string' ? s.substring(0, 10) + "..." : 'Zero'));
        console.log("Instruction lengths:", instructions.map(i => i.length));

        // Execute buy with Raydium pool creation
        console.log("\nExecuting buy with Raydium pool creation...");
        await logTransaction(
            await TokenFactory.buy(newTokenAddress, buyAmount, 
                { lamports: lamports, salt: saltValues, instruction: instructions }, 
                {fundingTokenATA: fundingTokenATABytes32, memeTokenATA: memeTokenATABytes32}),
            "Buy transaction before Raydium pool creation"
        );
        // Check final state
        const tokenState = await TokenFactory.tokens(newTokenAddress);
        
        if (tokenState === TokenState.TRADING) {
                console.log("Successfully reached funding goal and created Raydium liquidity pool!");
                console.log("Raydium pool should be created for tokens:");
                console.log(`- Token A (new token): ${newTokenMint}`);
                console.log(`- Token B (WSOL): ${wsolTokenMint}`);
        } else {
        console.log("Failed to reach funding goal or create liquidity pool.");
        const collateralAfter = await TokenFactory.collateral(newTokenAddress);
            console.log(`Current collateral: ${ethers.formatUnits(collateralAfter, wsolDecimals)} WSOL`);
            console.log(`Funding goal: ${ethers.formatUnits(FUNDING_GOAL_MULTIPLIER, wsolDecimals)} WSOL`);
        }

    } catch (err) {
        console.error("Error during Raydium pool setup:", err);
        throw err;
    }
    
    console.log("\n--- Testing Completed Successfully ---");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 