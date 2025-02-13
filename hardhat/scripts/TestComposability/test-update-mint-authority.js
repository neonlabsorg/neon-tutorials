const { ethers, network, run } = require("hardhat")
const web3 = require("@solana/web3.js");
const { createSetAuthorityInstruction, getMint } = require('@solana/spl-token');
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

    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed");

    const testComposability = await deployTestComposabilityContract()

    // =================================== Update SPL token mint authority ====================================

    const newAuthority = (await web3.Keypair.generate()).publicKey.toBuffer()
    const seed = 'myTokenMintSeed00';

    console.log('\nCalling testComposability.testUpdateMintAuthority: ')

    let tx = await testComposability.testUpdateMintAuthority(
        Buffer.from(seed), // Seed that was used to generate SPL token mint
        newAuthority,
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

    const tokenMint = await testComposability.tokenMint()
    console.log(ethers.encodeBase58(tokenMint), 'Updated token mint\n')
    const info = await getMint(solanaConnection, new web3.PublicKey(ethers.encodeBase58(tokenMint)));
    console.log(info, 'Updated token mint info')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })