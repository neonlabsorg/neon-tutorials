const {
    Raydium,
    TxVersion,
    parseTokenAccountResp,
} = require("@raydium-io/raydium-sdk-v2");
const { Connection, Keypair, clusterApiUrl } = require("@solana/web3.js");
const {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddress,
    getAccount,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
} = require("@solana/spl-token");
const bs58 = require("bs58");
const {DEVNET_PROGRAM_ID, MARKET_STATE_LAYOUT_V3, LIQUIDITY_STATE_LAYOUT_V4} = require("@raydium-io/raydium-sdk");
const web3 = require("@solana/web3.js");
require("dotenv").config();

const owner = Keypair.fromSecretKey(
    bs58.default.decode(process.env.PRIVATE_KEY_SOLANA)
);
const connection = new Connection(clusterApiUrl("devnet")); // For devnet
const txVersion = TxVersion.LEGACY; // TxVersion.V0 or TxVersion.LEGACY

let raydium;
const initSdk = async (params) => {
    if (raydium) return raydium;
    raydium = await Raydium.load({
        owner,
        connection,
        cluster: "devnet", // 'mainnet' | 'devnet'
        disableFeatureCheck: true,
        disableLoadToken: !(params && params.loadToken),
        blockhashCommitment: "finalized",
        // urlConfigs: {
        //   BASE_HOST: '<API_HOST>', // API URL configs, currently API doesn't support devnet
        // },
    });

    /**
     * By default: SDK will automatically fetch token account data when needed or any SOL balance changes.
     * If you want to handle token account by yourself, set token account data after initializing the SDK.
     * Code below shows how to do it.
     * Note: After calling raydium.account.updateTokenAccount, Raydium will not automatically fetch token accounts.
     */

    /*
      raydium.account.updateTokenAccount(await fetchTokenAccountData());
      connection.onAccountChange(owner.publicKey, async () => {
        raydium.account.updateTokenAccount(await fetchTokenAccountData());
      });
      */

    return raydium;
};

const fetchTokenAccountData = async () => {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey);
    const tokenAccountResp = await connection.getTokenAccountsByOwner(
        owner.publicKey,
        { programId: TOKEN_PROGRAM_ID }
    );
    const token2022Req = await connection.getTokenAccountsByOwner(
        owner.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
    );
    const tokenAccountData = parseTokenAccountResp({
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    });
    return tokenAccountData;
};

const fetchOpenBookAccounts = async (baseMint, quoteMint) => {
    console.log("Fetching open book accounts...")

    const accounts = await connection.getProgramAccounts(
        DEVNET_PROGRAM_ID.OPENBOOK_MARKET,
        {
            commitment: "confirmed",
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

const fetchMarketAccounts = async (baseMint, quoteMint) => {
    console.log("Fetching market accounts...")

    const accounts = await connection.getProgramAccounts(
        // networkData.marketProgramId,
        // MAINNET_PROGRAM_ID.AmmV4,
        DEVNET_PROGRAM_ID.AmmV4,
        {
            commitment: "confirmed",
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

const getPoolKeys = async (baseMint, quoteMint ) => {
    const openBookAccounts = await fetchOpenBookAccounts(baseMint, quoteMint)
    const marketAccounts = await fetchMarketAccounts(baseMint, quoteMint)

    if(openBookAccounts.length && marketAccounts.length) {
        const base = {
            programId: DEVNET_PROGRAM_ID.AmmV4, // Raydium AMM V4 program on Solana devnet
            id: marketAccounts[0].id,
            mintA: baseMint,
            mintB: quoteMint,
            openTime: marketAccounts[0].poolOpenTime,
            vault: { A: openBookAccounts[0].baseVault, B: openBookAccounts[0].quoteVault }
            // lookupTableAccount?: string
        }

        const market = {
            marketProgramId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // Market created via OpenBook program
            marketId: marketAccounts[0].marketId,
            marketAuthority: marketAccounts[0].owner, // ?? Or use market deployer (owner) account defined in config.js ??
            marketBaseVault: marketAccounts[0].baseVault,
            marketQuoteVault: marketAccounts[0].quoteVault,
            marketBids: openBookAccounts[0].bids,
            marketAsks: openBookAccounts[0].asks,
            marketEventQueue: openBookAccounts[0].eventQueue
        }

        const amm = {
            authority: marketAccounts[0].owner,
            openOrders: marketAccounts[0].openOrders,
            targetOrders: marketAccounts[0].targetOrders,
            mintLp: marketAccounts[0].lpMint
        }

        return {...base, ...amm, ...market}
    } else {
        console.warn("No OpenBook or market account found")
    }
}

const createInitializeATA = async (tokenMintPublicKey, ownerPublicKey, payer) => {
    // Initializing user's tokenOut ATA
    console.log('Creating and initializing userATA...');
    const solanaTx = new web3.Transaction();
    const ownerATA = getAssociatedTokenAddressSync(
        tokenMintPublicKey,
        ownerPublicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log("New user ATA: " + ownerATA.toBase58())
    solanaTx.add(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            ownerATA,
            ownerPublicKey,
            tokenMintPublicKey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );
    console.log('Sign, broadcast and confirm transaction...');
    const signature = await web3.sendAndConfirmTransaction(
        connection,
        solanaTx,
        [payer],
    );
    console.log('Signature: ', signature);
}

const getSwapATAs = async (swapConfig) => {
    const tokenIn_ATA = await getAssociatedTokenAddress(
        new web3.PublicKey(swapConfig.tokenIn),
        swapConfig.user.publicKey,
        true
    );
    const tokenIn_ATAInfo = await connection.getAccountInfo(tokenIn_ATA);

    const tokenOut_ATA = await getAssociatedTokenAddress(
        new web3.PublicKey(swapConfig.tokenOut),
        swapConfig.user.publicKey,
        true
    );
    const tokenOut_ATAInfo = await connection.getAccountInfo(tokenOut_ATA);

    if (!tokenIn_ATAInfo || !tokenOut_ATAInfo) {
        if (!tokenIn_ATAInfo) {
            console.warn('Account ' + swapConfig.user.publicKey + ' does not have initialized ATA account for tokenIn ( ' + swapConfig.tokenIn + ' )');
        }
        if (!tokenOut_ATAInfo) {
            console.log('Account ' + swapConfig.user.publicKey + ' does not have initialized ATA account for tokenOut ( ' + swapConfig.tokenOut + ' )');
            await createInitializeATA(new web3.PublicKey(swapConfig.tokenOut), swapConfig.user.publicKey, swapConfig.user)
        }
    }

    const tokenInBalance = (await getAccount(connection, tokenIn_ATA)).amount
    console.log(tokenInBalance, 'tokenInBalance')

    if (Number((await getAccount(connection, tokenIn_ATA)).amount) < swapConfig.tokenInAmount) {
        console.warn('Account ' + swapConfig.user.publicKey + ' does not have enough tokenIn ( ' + swapConfig.tokenIn  + ' ) amount to proceed with the swap execution');
    }

    return({ tokenIn_ATA, tokenOut_ATA })
}

module.exports = {
    owner,
    connection,
    txVersion,
    initSdk,
    fetchTokenAccountData,
    fetchOpenBookAccounts,
    fetchMarketAccounts,
    getPoolKeys,
    createInitializeATA,
    getSwapATAs
};
