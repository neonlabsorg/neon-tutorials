const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} = require("@solana/spl-token");
const {
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
  DEV_LOCK_CPMM_PROGRAM,
  DEV_LOCK_CPMM_AUTH,
} = require("@raydium-io/raydium-sdk-v2");
const { config } = require("../config");
const { initSdk, txVersion, connection } = require("./config");
const BN = require("bn.js");

async function main() {
  const [owner, user] = await ethers.getSigners();
  const raydium = await initSdk();

  let SOLANA_NODE;
  let TestCallSolanaAddress;
  if (network.name == "neonmainnet") {
    SOLANA_NODE = config.SOLANA_NODE_MAINNET;
    TestCallSolanaAddress = config.CALL_SOLANA_SAMPLE_CONTRACT_MAINNET;
  } else if (network.name == "neondevnet") {
    SOLANA_NODE = config.SOLANA_NODE;
    TestCallSolanaAddress = config.CALL_SOLANA_SAMPLE_CONTRACT;
  }

  const TestCallSolanaFactory = await ethers.getContractFactory(
    "TestCallSolana"
  );
  let TestCallSolana;
  let solanaTxCreatePool, solanaTxLockLP;
  let tx;
  let receipt;

  if (ethers.isAddress(TestCallSolanaAddress)) {
    TestCallSolana = TestCallSolanaFactory.attach(TestCallSolanaAddress);
  } else {
    TestCallSolana = await ethers.deployContract("TestCallSolana");
    await TestCallSolana.waitForDeployment();

    TestCallSolanaAddress = TestCallSolana.target;
    console.log(`TestCallSolana deployed to ${TestCallSolana.target}`);
  }

  const payer = ethers.encodeBase58(await TestCallSolana.getPayer());
  console.log(payer, "payer");

  // Get payer account balance
  const payerBalance = await connection.getBalance(new web3.PublicKey(payer));
  console.log(
    "Payer SOL Balance:",
    payerBalance / web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  const contractPublicKeyInBytes = await TestCallSolana.getNeonAddress(
    TestCallSolanaAddress
  );
  const contractPublicKey = ethers.encodeBase58(contractPublicKeyInBytes);
  console.log(contractPublicKey, "contractPublicKey");

  const contractBalance = await connection.getBalance(
    new web3.PublicKey(contractPublicKey)
  );
  console.log(
    "Contract SOL Balance:",
    contractBalance / web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  // Calculate PDA of an external authority that is needed as an additional signer for the Solana instruction
  const salt =
    "0x0000000000000000000000000000000000000000000000000000000000000378";
  const externalAuthority = ethers.encodeBase58(
    await TestCallSolana.getExtAuthority(salt)
  );
  console.log(externalAuthority, "extAuthority");

  const ataContractTNEON12 = await getAssociatedTokenAddress(
    new web3.PublicKey(config.DATA.SVM.ADDRESSES.TNEON12),
    new web3.PublicKey(payer),
    true
  );
  try {
    await getAccount(connection, ataContractTNEON12);
  } catch (err) {
    return console.error(
      "Account " +
        payer +
        " does not have initialized ATA account for TokenA ( " +
        config.DATA.SVM.ADDRESSES.TNEON12 +
        " )."
    );
  }

  const ataContractWSOL = await getAssociatedTokenAddress(
    new web3.PublicKey(config.DATA.SVM.ADDRESSES.WSOL),
    new web3.PublicKey(payer),
    true
  );
  try {
    await getAccount(connection, ataContractWSOL);
  } catch (err) {
    return console.error(
      "\nAccount " +
        payer +
        " does not have initialized ATA account for TokenB ( " +
        config.DATA.SVM.ADDRESSES.WSOL +
        " )."
    );
  }

  console.log(ataContractWSOL, "ataContractWSOL");
  console.log(ataContractTNEON12, "ataContractTNEON12");

  //*************************** CREATE CPMM POOL *********************************//

  const mintA = await raydium.token.getTokenInfo(
    config.DATA.SVM.ADDRESSES.TNEON12
  );
  const mintB = await raydium.token.getTokenInfo(
    config.DATA.SVM.ADDRESSES.WSOL
  );

  const feeConfigs = await raydium.api.getCpmmConfigs();

  if (raydium.cluster === "devnet") {
    feeConfigs.forEach((config) => {
      config.id = getCpmmPdaAmmConfigId(
        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
        config.index
      ).publicKey.toBase58();
    });
  }

  const instructionBuilderForCreatePool = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
    mintA,
    mintB,
    mintAAmount: new BN(4000000000),
    mintBAmount: new BN(1000000),
    startTime: new BN(0),
    feeConfig: feeConfigs[0],
    associatedOnly: false,
    ownerInfo: {
      useSOLBalance: true,
    },
    feePayer: new web3.PublicKey(payer),
    txVersion,
  });

  console.log("Extra info:", instructionBuilderForCreatePool.extInfo);

  // First account of the 3rd instruction is the payer and the signer account and this account is not writable by default
  // Hence, the account has to be overwritten to add the account as writable.
  instructionBuilderForCreatePool.builder.instructions[2].keys[0] = {
    pubkey: new web3.PublicKey(payer),
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

  //BUILD RAYDIUM CREATE POOL INSTRUCTION

  console.log("\nBroadcast creating pool transaction...");
  solanaTxCreatePool = new web3.Transaction();
  solanaTxCreatePool.add(
    instructionBuilderForCreatePool.builder.instructions[0]
  );
  solanaTxCreatePool.add(
    instructionBuilderForCreatePool.builder.instructions[1]
  );
  solanaTxCreatePool.add(
    instructionBuilderForCreatePool.builder.instructions[2]
  );

  console.log("\nProcessing batchExecute method with all instructions ...");
  [tx, receipt] = await config.utils.batchExecute(
    solanaTxCreatePool.instructions,
    [50000000, 0, 1050000000],
    TestCallSolana,
    undefined,
    user
  );
  console.log(tx, "tx");
  for (let i = 0, len = receipt.logs.length; i < len; ++i) {
    console.log(receipt.logs[i].args, " receipt args instruction #", i);
  }

  //*************************** LOCK LIQUIDITY *********************************/

  const poolId = new web3.PublicKey(
    instructionBuilderForCreatePool.builder.instructions[2].keys[3].pubkey
    //"69hMkwesp1LYcWZrnzNbuu6oMHLdkKgdaUx6WCnfvz8c"
  );
  console.log("Pool Id", poolId);

  let poolInfo;
  let poolKeys;
  if (raydium.cluster === "mainnet") {
    // Note: API doesn't support getting devnet pool info, so in devnet we use RPC method
    // If you wish to get pool info from RPC, modify logic accordingly
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    poolInfo = data[0];
    if (!isValidCpmm(poolInfo.programId))
      throw new Error("Target pool is not CPMM pool");
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
  }

  /** If you already know how much liquidity can be locked, skip fetching account balance */
  await raydium.account.fetchWalletTokenAccounts();
  const lpBalance = raydium.account.tokenAccounts.find(
    (a) => a.mint.toBase58() === poolInfo.lpMint.address
  );
  if (!lpBalance) throw new Error(`You do not have balance in pool: ${poolId}`);

  const instructionBuilderForLockingLiquidity = await raydium.cpmm.lockLp({
    programId: DEV_LOCK_CPMM_PROGRAM, // devnet
    authProgram: DEV_LOCK_CPMM_AUTH, // devnet
    poolKeys, // devnet
    poolInfo,
    feePayer: new web3.PublicKey(payer),
    lpAmount: lpBalance.amount,
    withMetadata: true,
    txVersion,
    getEphemeralSigners: async (k) => {
      return new Array(k).fill(new web3.PublicKey(externalAuthority)); // Use the provided signer
    },
  });

  console.log(
    "Instruction builder:",
    instructionBuilderForLockingLiquidity.builder
  );
  console.log("Extra info:", instructionBuilderForLockingLiquidity.extInfo);

  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[2].isWritable = true;
  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isSigner = true;
  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isWritable = true;

  console.log(
    instructionBuilderForLockingLiquidity.builder.instructions[0],
    "CPMM Lock LP"
  );

  //BUILD LOCK LIQUIDITY INSTRUCTION

  console.log("\nBroadcast locking LP transaction...");
  solanaTxLockLP = new web3.Transaction();
  solanaTxLockLP.add(
    instructionBuilderForLockingLiquidity.builder.instructions[0]
  );

  [tx, receipt] = await config.utils.execute(
    solanaTxLockLP.instructions[0],
    1000000000,
    TestCallSolana,
    salt,
    user
  );
  console.log(tx, "tx");
  console.log(receipt.logs[0].args, "receipt args");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
