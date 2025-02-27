const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const { MINT_SIZE } = require("@solana/spl-token");
const {
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
  let solanaTx;
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

  const minBalance = await connection.getMinimumBalanceForRentExemption(
    MINT_SIZE
  );
  console.log("Minimum balance:", minBalance);

  //*************************** LOCK LIQUIDITY *********************************//

  const poolId = new web3.PublicKey(
    "69hMkwesp1LYcWZrnzNbuu6oMHLdkKgdaUx6WCnfvz8c"
  );

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
    ownerInfo: {
      feePayer: new web3.PublicKey(payer),
      wallet: new web3.PublicKey(payer),
    },
    feePayer: new web3.PublicKey(payer),
    lpAmount: lpBalance.amount,
    withMetadata: true,
    txVersion,
  });

  console.log("Extra info:", instructionBuilderForLockingLiquidity.extInfo);

  //instructionBuilderForLockingLiquidity.builder.instructions[0].keys[2].isWritable = true;

  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isSigner = true;
  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[3].isWritable = true;

  /*instructionBuilderForLockingLiquidity.builder.instructions[0].keys[4].isSigner = true;
  instructionBuilderForLockingLiquidity.builder.instructions[0].keys[4].isWritable = true;*/

  console.log(
    instructionBuilderForLockingLiquidity.builder.instructions[0],
    "CPMM Lock LP"
  );

  //BUILD LOCK LIQUIDITY INSTRUCTION

  console.log("\nBroadcast locking LP transaction...");
  solanaTx = new web3.Transaction();
  solanaTx.add(instructionBuilderForLockingLiquidity.builder.instructions[0]);

  [tx, receipt] = await config.utils.execute(
    solanaTx.instructions[0],
    0,
    TestCallSolana,
    undefined,
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
