const {
    LIQUIDITY_STATE_LAYOUT_V4,
    MARKET_STATE_LAYOUT_V3,
    DEVNET_PROGRAM_ID
} = require("@raydium-io/raydium-sdk")
const web3 = require("@solana/web3.js")

// Define a function to fetch and decode OpenBook accounts
async function fetchOpenBookAccounts(
    connection,
    baseMint,
    quoteMint,
    commitment
) {
    const accounts = await connection.getProgramAccounts(
        DEVNET_PROGRAM_ID.OPENBOOK_MARKET,
        {
            commitment,
            filters: [
                { dataSize: MARKET_STATE_LAYOUT_V3.span },
                {
                    memcmp: {
                        offset: MARKET_STATE_LAYOUT_V3.offsetOf("baseMint"),
                        bytes: baseMint.toBase58(),
                    },
                },
                {
                    memcmp: {
                        offset: MARKET_STATE_LAYOUT_V3.offsetOf("quoteMint"),
                        bytes: quoteMint.toBase58(),
                    },
                },
            ],
        }
    );

    return accounts.map(({ account }) =>
        MARKET_STATE_LAYOUT_V3.decode(account.data)
    );
}

// Define a function to fetch and decode Market accounts
async function fetchMarketAccounts(
    connection,
    baseMint,
    quoteMint,
    commitment
) {
    const accounts = await connection.getProgramAccounts(
        // networkData.marketProgramId,
        // MAINNET_PROGRAM_ID.AmmV4,
        DEVNET_PROGRAM_ID.AmmV4,
        {
            commitment,
            filters: [
                { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
                {
                    memcmp: {
                        offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
                        bytes: baseMint.toBase58(),
                    },
                },
                {
                    memcmp: {
                        offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
                        bytes: quoteMint.toBase58(),
                    },
                },
            ],
        }
    );

    return accounts.map(({ pubkey, account }) => ({
        id: pubkey.toString(),
        ...LIQUIDITY_STATE_LAYOUT_V4.decode(account.data),
    }));
}

async function main() {
    const SOLANA_CONNECTION = new web3.Connection(
        process.env.SOLANA_NODE,
        "confirmed"
    );
    // DEVNET
    const baseMint = new web3.PublicKey(
        "37jexVqVGrrT7erf7wSHTar5NJCvZTQ6otjgarffNNfX"
    );
    const quoteMint = new web3.PublicKey(
        "So11111111111111111111111111111111111111112" // WSOL
    );

    let openBookAccounts = await fetchOpenBookAccounts(
        SOLANA_CONNECTION,
        baseMint,
        quoteMint,
        "confirmed"
    );

    console.log(openBookAccounts);
    console.log(`Number of OpenBook accounts: ${openBookAccounts.length}`);

    let marketAccounts = await fetchMarketAccounts(
        SOLANA_CONNECTION,
        baseMint,
        quoteMint,
        "confirmed"
    );

    console.log(marketAccounts);
    console.log(`poolOpenTime: ${marketAccounts[0].poolOpenTime}`);
    console.log(`Number of market accounts: ${marketAccounts.length}`);
}

main();