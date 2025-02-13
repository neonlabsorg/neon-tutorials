const { ethers, network, run } = require("hardhat")
const web3 = require("@solana/web3.js");
const { airdropNEON, deployTestComposabilityContract, getSolanaTransactions } = require("./utils");

async function main() {
    await run("compile")

    console.log("\nNetwork name: " + network.name)

    if (!process.env.DEPLOYER_KEY) {
        throw new Error("\nMissing private key: DEPLOYER_KEY")
    }

    const deployer = (await ethers.getSigners())[0]
    console.log("\nDeployer address: " + deployer.address)

    let deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address))
    const minBalance = ethers.parseUnits("10000", 18) // 10000 NEON
    if(
        deployerBalance < minBalance &&
        parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)) > 0
    ) {
        await airdropNEON(deployer.address, parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)))
        deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address))
    }
    console.log("\nDeployer balance: " + ethers.formatUnits(deployerBalance.toString(), 18) + " NEON")

    const testComposability = await deployTestComposabilityContract()

    // =================================== Mint SPL token amount to deployer ATA ====================================

    const seed = 'myTokenMintSeed03';
    const tokenMint = await testComposability.tokenMint()
    const deployerATA = await testComposability.getAssociatedTokenAccount(
        tokenMint,
        deployer.address,
        255
    );

    console.log('\nCalling testComposability.testMintTokens: ')

    let tx = await testComposability.connect(deployer).testMintTokens(
        Buffer.from(seed), // Seed that was used to generate SPL token mint
        deployerATA, // Solana recipient ATA
        1000 * 10 ** 9 // amount (mint 1000 tokens)
    )

    console.log('\nNeonEVM transaction hash: ' + tx.hash)
    await tx.wait(1) // Wait for 1 confirmation
    let txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
    console.log(txReceipt.status, 'txReceipt.status')

    let solanaTransactions = (await (await getSolanaTransactions(tx.hash)).json()).result

    console.log('\nSolana transactions signatures:')
    for await (let txId of solanaTransactions) {
        console.log(txId)
    }
    console.log("\n")

    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed");
    const info = await solanaConnection.getTokenAccountBalance(
        new web3.PublicKey(ethers.encodeBase58(deployerATA))
    );
    console.log(info, 'Deployer ATA info')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })