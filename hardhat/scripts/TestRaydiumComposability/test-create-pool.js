const {
    MARKET_STATE_LAYOUT_V3,
    AMM_V4,
    OPEN_BOOK_PROGRAM,
    FEE_DESTINATION_ID,
    DEVNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk-v2");
const { initSdk, txVersion } = require("./config");
const { PublicKey } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const BN = require("bn.js");

const createAmmPool = async () => {
    try {
        const raydium = await initSdk();
        const marketId = new PublicKey(
            "AK6BNvFZznJQcS4wMhZo4qc1zJ7ruMTn2EDKCJchgjWg"
        );

        // If you are sure about your market info, you don't need to get market info from RPC
        const marketBufferInfo = await raydium.connection.getAccountInfo(
            new PublicKey(marketId)
        );
        console.log(marketBufferInfo, 'marketBufferInfo');

        const { baseMint, quoteMint } = MARKET_STATE_LAYOUT_V3.decode(
            marketBufferInfo.data
        );

        // Check mint info here: https://api-v3.raydium.io/mint/list
        // Or get mint info using the API: await raydium.token.getTokenInfo('mint address')

        // AMM pool doesn't support token 2022
        const baseMintInfo = await raydium.token.getTokenInfo(baseMint);
        const quoteMintInfo = await raydium.token.getTokenInfo(quoteMint);
        const baseAmount = new BN(1000000000000); // 1000 TRT
        const quoteAmount = new BN(10000000); // 0.01 wSOL

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

        const { execute, extInfo } = await raydium.liquidity.createPoolV4({
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
            baseAmount: baseAmount,
            quoteAmount: quoteAmount,

            // sol devnet faucet: https://faucet.solana.com/
            // baseAmount: new BN(4 * 10 ** 9), // If devnet pool with SOL/WSOL, use amount >= 4*10**9
            // quoteAmount: new BN(4 * 10 ** 9), // If devnet pool with SOL/WSOL, use amount >= 4*10**9

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

        console.log(execute, extInfo);

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