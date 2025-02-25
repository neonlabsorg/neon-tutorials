const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} = require("@solana/spl-token");
const {
  CREATE_CPMM_POOL_PROGRAM,
  CREATE_CPMM_POOL_FEE_ACC,
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
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
        " does not have initialized ATA account for TokenA ( " +
        config.DATA.SVM.ADDRESSES.WSOL +
        " )."
    );
  }

  const ataContractTNEON2 = await getAssociatedTokenAddress(
    new web3.PublicKey(config.DATA.SVM.ADDRESSES.TNEON2),
    new web3.PublicKey(payer),
    true
  );
  try {
    await getAccount(connection, ataContractTNEON2);
  } catch (err) {
    return console.error(
      "Account " +
        payer +
        " does not have initialized ATA account for TokenB ( " +
        config.DATA.SVM.ADDRESSES.TNEON2 +
        " )."
    );
  }

  console.log(ataContractWSOL, "ataContractWSOL");
  console.log(ataContractTNEON2, "ataContractTNEON2");

  const mintA = await raydium.token.getTokenInfo(
    config.DATA.SVM.ADDRESSES.TNEON2
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

  const { builder } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
    mintA,
    mintB,
    mintAAmount: new BN(4000000),
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

  console.log("Instruction builder:", builder);

  // First account of the 3rd instruction is the payer and the signer account and this account is not writable by default
  // Hence, the account has to be overwritten to add the account as writable.
  builder.instructions[2].keys[0] = {
    pubkey: new web3.PublicKey(payer),
    isSigner: true,
    isWritable: true,
  };

  // /BUILD RAYDIUM CREATE POOL INSTRUCTION

  console.log(
    "\n ***OWNER*** Broadcast Raydium create WSOL/TNEON2 CPMM pool ... "
  );
  console.log(builder.instructions[0], "Create Account");
  console.log(builder.instructions[1], "Init Account");
  console.log(builder.instructions[2], "Cpmm Create Pool");

  solanaTx = new web3.Transaction();
  solanaTx.add(builder.instructions[0]);
  solanaTx.add(builder.instructions[1]);
  solanaTx.add(builder.instructions[2]);
  //solanaTx.add(builder.endInstructions[0]);

  console.log("Processing batchExecute method with all instructions ...");
  [tx, receipt] = await config.utils.batchExecute(
    solanaTx.instructions,
    [minBalance, 0, 4000000000],
    TestCallSolana,
    undefined,
    user
  );
  console.log(tx, "tx");
  for (let i = 0, len = receipt.logs.length; i < len; ++i) {
    console.log(receipt.logs[i].args, " receipt args instruction #", i);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
