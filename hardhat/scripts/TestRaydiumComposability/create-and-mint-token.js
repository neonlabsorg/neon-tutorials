const web3 = require("@solana/web3.js");
const {
    createInitializeMint2Instruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createInitializeAccount2Instruction,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const { Metaplex } = require("@metaplex-foundation/js");
const { createCreateMetadataAccountV3Instruction } = require('@metaplex-foundation/mpl-token-metadata');
const bs58 = require("bs58");
const { config } = require('../TestCallSolana/config.js');

async function main() {
    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed");
    const owner = web3.Keypair.fromSecretKey(
        bs58.default.decode(process.env.PRIVATE_KEY_SOLANA)
    );

    const seed = 'seed' + Date.now().toString(); // random seed on each script call

    const tokenMint = await web3.PublicKey.createWithSeed(owner.publicKey, seed, new web3.PublicKey(TOKEN_PROGRAM_ID));
    console.log(tokenMint, 'Token mint address');

    const rentExemptBalance = await solanaConnection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // ============================= createAccountWithSeed INSTRUCTION ====================================
    const solanaTx = new web3.Transaction();
    solanaTx.add(
        web3.SystemProgram.createAccountWithSeed({
            fromPubkey: owner.publicKey,
            basePubkey: owner.publicKey,
            newAccountPubkey: tokenMint,
            seed: seed,
            lamports: rentExemptBalance, // enough lamports to make the account rent exempt
            space: MINT_SIZE,
            programId: new web3.PublicKey(TOKEN_PROGRAM_ID) // programId
        })
    );

    // ============================= InitializeMint2 INSTRUCTION ====================================
    solanaTx.add(
        createInitializeMint2Instruction(
            tokenMint,
            9, // decimals
            owner.publicKey, // mintAuthority
            owner.publicKey, // freezeAuthority
            new web3.PublicKey(TOKEN_PROGRAM_ID) // programId
        )
    );

    // ============================= CreateMetadataAccountV3Instruction INSTRUCTION ====================================
    const metaplex = new Metaplex(solanaConnection);
    const metadata = metaplex.nfts().pdas().metadata({mint: tokenMint});
    solanaTx.add(
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadata,
                mint: tokenMint,
                mintAuthority: owner.publicKey,
                payer: owner.publicKey,
                updateAuthority: owner.publicKey
            },
            {
                createMetadataAccountArgsV3: {
                    data: {
                        name: "Test Raydium Token",
                        symbol: "TRT",
                        uri: '',
                        sellerFeeBasisPoints: 0,
                        collection: null,
                        creators: null,
                        uses: null
                    },
                    isMutable: true,
                    collectionDetails: null
                },
            }
        )
    );

    const ownerATA = getAssociatedTokenAddressSync(
        tokenMint,
        owner.publicKey,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    solanaTx.add(
        createAssociatedTokenAccountInstruction(
            owner.publicKey,
            ownerATA,
            owner.publicKey,
            tokenMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );

    solanaTx.add(
        createMintToInstruction(
            tokenMint,
            ownerATA,
            owner.publicKey,
            1000000 * 10 ** 9
        )
    )

    console.log('Sign, broadcast and confirm transaction...');
    const signature = await web3.sendAndConfirmTransaction(
        solanaConnection,
        solanaTx,
        [owner],
    );
    console.log('Signature: ', signature);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});