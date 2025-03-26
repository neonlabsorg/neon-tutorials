const {
  WSOLMint,
  OPEN_BOOK_PROGRAM,
  DEVNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk-v2");
const { initSdk, txVersion } = require("./config");
const { PublicKey } = require("@solana/web3.js");
const BN = require("bn.js");

const createMarket = async () => {
  const raydium = await initSdk();

  // Check mint info here: https://api-v3.raydium.io/mint/list
  // or get mint info by API: await raydium.token.getTokenInfo('mint address')

  let info = await raydium.token.getTokenInfo(
    "3MRAFn6aLDhnvfFbhnjn3sBjBfLTYQHoWhGMQyb7YW8d"
  );
  console.log(info, "TNEON5 mint info");

  info = await raydium.token.getTokenInfo(WSOLMint.toBase58());
  console.log(info, "WSOL mint info");

  console.log("Devnet program ID:", DEVNET_PROGRAM_ID.OPENBOOK_MARKET);

  console.log(WSOLMint, "WSOLMint");

  const { execute, extInfo, transactions } = await raydium.marketV2.create({
    baseInfo: {
      // TNEON5 token
      mint: new PublicKey("3MRAFn6aLDhnvfFbhnjn3sBjBfLTYQHoWhGMQyb7YW8d"),
      decimals: 9,
    },
    quoteInfo: {
      // Create market doesn't support token 2022
      mint: WSOLMint,
      decimals: 9,
    },
    lotSize: 1000000,
    tickSize: 0.1,
    //dexProgramId: OPEN_BOOK_PROGRAM,
    dexProgramId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // Use for devnet

    // Optional queue space configurations
    // requestQueueSpace: 5120 + 12, // optional
    // eventQueueSpace: 262144 + 12, // optional
    // orderbookQueueSpace: 65536 + 12, // optional

    txVersion,
    // Optional: Set up priority fee here
    // computeBudgetConfig: {
    //   units: 600000,
    //   microLamports: 46591500,
    // },
  });

  console.log("📌 Transaction Instructions: ", transactions);
  console.log("📌 Extra Info: ", extInfo);

  console.log(
    `Create market total ${transactions.length} transactions, market info:`,
    Object.keys(extInfo.address).reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: extInfo.address[cur].toBase58(),
      }),
      {}
    )
  );

  const txIds = await execute({
    // Set sequentially to true means transactions will be sent sequentially, waiting for confirmation of the previous one
    sequentially: true,
  });

  console.log(
    "Note: Create market does not support token 2022. If you need more detailed error info, set txVersion to TxVersion.LEGACY."
  );
  console.log("Create market transaction IDs:", txIds);
  process.exit(); // If you don't want to end Node.js execution, comment this line
};

/** Uncomment the code below to execute */
createMarket();

module.exports = {
  createMarket,
};
