const {
  MARKET_STATE_LAYOUT_V3,
  AMM_V4,
  OPEN_BOOK_PROGRAM,
  FEE_DESTINATION_ID,
  DEVNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk-v2");
const { initSdk, txVersion } = require("./config");
const web3 = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const BN = require("bn.js");

const createAmmPool = async () => {
  try {
    const raydium = await initSdk({ loadToken: true });
    const marketId = new web3.PublicKey(
      //"BhTBX9GdK6MVpCCmd4s37Gxe5Vu7HnoBAzeWnim5svyi" // Mainnet
      "8XNyJraQbtUTgiXvNTGS9AA9SxmoCXBUSnqeyn3jroej" // Devnet
    );

    console.log(
      "Openbook Devnet program id:",
      DEVNET_PROGRAM_ID.OPENBOOK_MARKET
    );
    console.log("Raydium Devnet program id", DEVNET_PROGRAM_ID.AmmV4);

    // If you are sure about your market info, you don't need to get market info from RPC
    const marketBufferInfo = await raydium.connection.getAccountInfo(
      new web3.PublicKey(marketId)
    );
    console.log(marketBufferInfo);
    const { baseMint, quoteMint } = MARKET_STATE_LAYOUT_V3.decode(
      marketBufferInfo.data
    );

    // Check mint info here: https://api-v3.raydium.io/mint/list
    // Or get mint info using the API: await raydium.token.getTokenInfo('mint address')

    // AMM pool doesn't support token 2022
    const baseMintInfo = await raydium.token.getTokenInfo(baseMint);
    const quoteMintInfo = await raydium.token.getTokenInfo(quoteMint);
    const baseAmount = new BN(4000000);
    const quoteAmount = new BN(1000000000);

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

    const { execute, extInfo, builder, transactions } =
      await raydium.liquidity.createPoolV4({
        //programId: AMM_V4,
        programId: DEVNET_PROGRAM_ID.AmmV4, // devnet
        marketInfo: {
          marketId,
          //programId: OPEN_BOOK_PROGRAM,
          programId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // devnet
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
        quoteAmount: new BN(1000000000),
        startTime: new BN(0), // Unit in seconds
        ownerInfo: {
          useSOLBalance: true,
        },
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

    console.log("📌 Transaction Instructions: ", transactions);

    console.log(builder, "createRaydiumPool");
    console.log(builder.instructions[0], "createPoolOnRaydium0");
    console.log(builder.instructions[1], "createPoolOnRaydium1");
    console.log(builder.instructions[2], "createPoolOnRaydium2");

    //console.log(execute, extInfo);

    // Don't want to wait for confirmation? Set sendAndConfirm to false or omit it in execute
    const { txId } = await execute({ sendAndConfirm: false });
    console.log(
      "AMM pool created! txId:",
      txId,
      ", poolKeys:",
      Object.keys(extInfo.address).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: extInfo.address[cur].toBase58(),
        }),
        {}
      )
    );
  } catch (error) {
    console.error("Error creating pool:", error);
  } finally {
    process.exit(); // If you don't want to end Node.js execution, comment this line
  }
};

/** Uncomment the code below to execute */
createAmmPool();

module.exports = {
  createAmmPool,
};
