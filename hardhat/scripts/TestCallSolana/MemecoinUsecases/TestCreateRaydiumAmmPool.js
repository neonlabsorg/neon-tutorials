const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  getAccount,
  createInitializeAccountInstruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} = require("@solana/spl-token");
const {
  MARKET_STATE_LAYOUT_V3,
  AMM_V4,
  OPEN_BOOK_PROGRAM,
  FEE_DESTINATION_ID,
  DEVNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk-v2");
const { config } = require("../config");
const { initSdk, txVersion, connection } = require("./config");
const BN = require("bn.js");

async function main() {
  const [owner, user] = await ethers.getSigners();
  //const connection = new web3.Connection(config.SOLANA_NODE, "processed");

  const raydium = await initSdk();
  //console.log(raydium);

  const WSOL = new ethers.Contract(
    config.DATA.EVM.ADDRESSES.WSOL_DEVNET,
    config.DATA.EVM.ABIs.ERC20ForSPL,
    ethers.provider
  );

  const TNEON3 = new ethers.Contract(
    config.DATA.EVM.ADDRESSES.TNEON3,
    config.DATA.EVM.ABIs.ERC20ForSPL,
    ethers.provider
  );

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

  const ownerPublicKeyInBytes = await TestCallSolana.getNeonAddress(owner);
  const ownerPublicKey = ethers.encodeBase58(ownerPublicKeyInBytes);
  console.log(ownerPublicKey, "ownerPublicKey");

  const minBalance = await connection.getMinimumBalanceForRentExemption(
    MINT_SIZE
  );
  console.log("Minimum balance:", minBalance);

  console.log("\n ***USER*** Broadcast WSOL approval ... ");
  tx = await WSOL.connect(user).approve(TestCallSolanaAddress, 0.03 * 10 ** 9);
  await tx.wait(1);
  console.log(tx, "tx");

  console.log("\n ***USER*** Broadcast TNEON3 approval ... ");
  tx = await TNEON3.connect(user).approve(TestCallSolanaAddress, 10 * 10 ** 6);
  await tx.wait(1);
  console.log(tx, "tx");

  const ataContractWSOL = await getAssociatedTokenAddress(
    new web3.PublicKey(config.DATA.SVM.ADDRESSES.WSOL),
    new web3.PublicKey(contractPublicKey),
    true
  );
  try {
    await getAccount(connection, ataContractWSOL);
  } catch (err) {
    return console.error(
      "\nAccount " +
        contractPublicKey +
        " does not have initialized ATA account for TokenA ( " +
        config.DATA.SVM.ADDRESSES.WSOL +
        " )."
    );
  }

  const ataContractTNEON3 = await getAssociatedTokenAddress(
    new web3.PublicKey(config.DATA.SVM.ADDRESSES.TNEON3),
    new web3.PublicKey(contractPublicKey),
    true
  );
  try {
    await getAccount(connection, ataContractTNEON3);
  } catch (err) {
    return console.error(
      "Account " +
        contractPublicKey +
        " does not have initialized ATA account for TokenB ( " +
        config.DATA.SVM.ADDRESSES.TNEON3 +
        " )."
    );
  }

  console.log(ataContractWSOL, "ataContractWSOL");
  console.log(ataContractTNEON3, "ataContractTNEON3");

  const marketId = new web3.PublicKey(
    "4rpopgZ7i2idPHhSqSoZmZNXhZTstHyWjfAaa4qnx4U2"
  );

  console.log("Openbook Devnet program id:", DEVNET_PROGRAM_ID.OPENBOOK_MARKET);
  console.log("Raydium Devnet program id", DEVNET_PROGRAM_ID.AmmV4);

  // If you are sure about your market info, you don't need to get market info from RPC
  const marketBufferInfo = await connection.getAccountInfo(
    new web3.PublicKey(marketId)
  );

  const { baseMint, quoteMint } = MARKET_STATE_LAYOUT_V3.decode(
    marketBufferInfo.data
  );

  // Check mint info here: https://api-v3.raydium.io/mint/list
  // Or get mint info using the API: await raydium.token.getTokenInfo('mint address')

  // AMM pool doesn't support token 2022
  const baseMintInfo = await raydium.token.getTokenInfo(baseMint);
  const quoteMintInfo = await raydium.token.getTokenInfo(quoteMint);
  const baseAmount = new BN(4000000);
  const quoteAmount = new BN(10000000);

  if (
    baseMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58() ||
    quoteMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58()
  ) {
    throw new Error(
      "AMM pools with OpenBook market only support TOKEN_PROGRAM_ID mints. For token-2022, create a CPMM pool instead."
    );
  }

  if (
    baseAmount
      .mul(quoteAmount)
      .lte(new BN(1).mul(new BN(10 ** baseMintInfo.decimals)).pow(new BN(2)))
  ) {
    throw new Error(
      "Initial liquidity too low. Try adding more baseAmount/quoteAmount."
    );
  }

  const { builder } = await raydium.liquidity.createPoolV4({
    //programId: AMM_V4,
    programId: DEVNET_PROGRAM_ID.AmmV4, // devnet
    marketInfo: {
      marketId,
      programId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET,
    },
    baseMintInfo: {
      mint: baseMint,
      decimals: baseMintInfo.decimals, // If you know mint decimals, you can pass the number directly
    },
    quoteMintInfo: {
      mint: quoteMint,
      decimals: quoteMintInfo.decimals, // If you know mint decimals, you can pass the number directly
    },
    baseAmount: new BN(4000000),
    quoteAmount: new BN(10000000),

    startTime: new BN(0), // Unit in seconds
    ownerInfo: {
      //feePayer: new web3.PublicKey(payer),
      useSOLBalance: true,
      //owner: new web3.PublicKey(contractPublicKey), // The keypair that signs transactions
    },
    feePayer: new web3.PublicKey(payer),
    associatedOnly: false,
    txVersion,
    //feeDestinationId: FEE_DESTINATION_ID,
    feeDestinationId: DEVNET_PROGRAM_ID.FEE_DESTINATION_ID, // devnet
    // Optional: Set up priority fee here
    /*computeBudgetConfig: {
      units: 600000,
      microLamports: 46591500,
    },*/
  });
  console.log("Instruction builder:", builder);

  // /BUILD RAYDIUM CREATE POOL INSTRUCTION

  console.log("\n ***OWNER*** Broadcast Raydium create WSOL/TNEON3 pool ... ");
  solanaTx = new web3.Transaction();

  /*builder.instructions[0].keys[0] = {
    pubkey: new web3.PublicKey(payer),
    isSigner: true,
    isWritable: true, // Mark as writable only if needed
  };

  builder.instructions[0].keys[2] = {
    pubkey: new web3.PublicKey(contractPublicKey),
    isSigner: true,
    isWritable: false, // Mark as writable only if needed
  };

  builder.instructions[2].keys[17] = {
    pubkey: new web3.PublicKey(payer),
    isSigner: true,
    isWritable: true, // Mark as writable only if needed
  };*/

  /*const elementToInsert = {
    pubkey: new web3.PublicKey(contractPublicKey),
    isSigner: true,
    isWritable: false, // Mark as writable only if needed
  }; // Element to insert
  const position = 21; // Insert at index 5 (6th position in 1-based index)

  // Insert element at the desired position
  builder.instructions[2].keys.splice(position, 0, elementToInsert);*/

  /*builder.instructions[2].keys[21] = {
    pubkey: new web3.PublicKey(contractPublicKey),
    isSigner: true,
    isWritable: false, // Mark as writable only if needed
  };*/

  console.log(builder.instructions[0], "createPoolOnRaydium0");
  console.log(builder.instructions[1], "createPoolOnRaydium1");
  console.log(builder.instructions[2], "createPoolOnRaydium2");

  solanaTx.add(builder.instructions[0]);
  solanaTx.add(builder.instructions[1]);
  solanaTx.add(builder.instructions[2]);

  console.log("Processing batchExecute method with all instructions ...");
  [tx, receipt] = await config.utils.batchExecute(
    solanaTx.instructions,
    //[5000000000],
    [minBalance, 0, 5000000000],
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
