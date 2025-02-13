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

    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed");

    const testComposability = await deployTestComposabilityContract()

    // =================================== Create and initialize new SPL associated token account ====================================

    const tokenMintInBytes =  await testComposability.tokenMint()

    console.log('\nCalling testComposability.testCreateInitializeATA: ')

    let tx = await testComposability.testCreateInitializeATA(
        tokenMintInBytes,
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), // Leave owner field empty so that msg.sender controls the ATA through TestComposability contract
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), // Leave tokenOwner field empty so that TestComposability contract owns the ATA
        255 // nonce
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

    const ata = await testComposability.ata()
    console.log(ethers.encodeBase58(ata), 'Created ATA')
    const info = await solanaConnection.getTokenAccountBalance(new web3.PublicKey(ethers.encodeBase58(ata)));
    console.log(info, 'Created ATA info')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })