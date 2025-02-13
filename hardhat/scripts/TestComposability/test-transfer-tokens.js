const { ethers, network, run } = require("hardhat")
const web3 = require("@solana/web3.js");
const { airdropNEON, deployTestComposabilityContract, getSolanaTransactions } = require("./utils");
const {createTransferInstruction} = require("@solana/spl-token");

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

    const neonEVMUserATAInBytes = await testComposability.ata() // NeonEVM user ata should be the last created ATA registered in TestComposability contract
    console.log('NeonEVM user ATA: ' + ethers.encodeBase58(neonEVMUserATAInBytes))

    // =================================== Create and initialize new ATA for Solana recipient ====================================

    const solanaRecipientPublicKey = (await web3.Keypair.generate()).publicKey
    console.log("\nSolana recipient account: " + solanaRecipientPublicKey.toBase58())

    const tokenMintInBytes =  await testComposability.tokenMint()

    console.log('\nCalling testComposability.testCreateInitializeATA: ')

    let tx = await testComposability.connect(deployer).testCreateInitializeATA(
        tokenMintInBytes,
        solanaRecipientPublicKey.toBuffer(), // Pass Solana recipient public key as owner
        solanaRecipientPublicKey.toBuffer(), // Pass Solana recipient public key as tokenOwner so that it owns the ATA
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

    const solanaRecipientATAInBytes = await testComposability.ata()
    console.log('Created Solana recipient ATA: ' + ethers.encodeBase58(solanaRecipientATAInBytes))
    let info = await solanaConnection.getTokenAccountBalance(
        new web3.PublicKey(ethers.encodeBase58(solanaRecipientATAInBytes))
    );
    console.log('Initial Solana recipient ATA balance: ' + info.value.uiAmount)

    // =================================== Transfer SPL token amount from deployer ATA to NeonEVM user ATA ====================================

    const tokenMint = await testComposability.tokenMint()
    const senderATANonce = 255 // This must be the same nonce that was used to create the sender's ATA through
    // the TestComposability contract

    console.log('\nCalling testComposability.testTransferTokens: ')

    tx = await testComposability.connect(deployer).testTransferTokens(
        tokenMint,
        senderATANonce,
        neonEVMUserATAInBytes,
        100 * 10 ** 9 // amount (transfer 10 tokens)
    )

    console.log('\nNeonEVM transaction hash: ' + tx.hash)
    await tx.wait(1) // Wait for 1 confirmation
    txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
    console.log(txReceipt.status, 'txReceipt.status')

    solanaTransactions = (await (await getSolanaTransactions(tx.hash)).json()).result

    console.log('\nSolana transactions signatures:')
    for await (let txId of solanaTransactions) {
        console.log(txId)
    }
    console.log("\n")

    info = await solanaConnection.getTokenAccountBalance(new web3.PublicKey(ethers.encodeBase58(neonEVMUserATAInBytes)));
    console.log('New NeonEVM user ATA balance: ' + info.value.uiAmount)

    // =================================== Transfer SPL token amount from NeonEVM user ATA to Solana user ATA====================================

    const neonEVMUserATANonce = 255 // This must be the same nonce that was used to create the NeonEVM user's ATA through
    // the TestComposability contract
    const neonEVMUser = (await ethers.getSigners())[1]

    console.log('\nCalling testComposability.testTransferTokens: ')

    tx = await testComposability.connect(neonEVMUser).testTransferTokens(
        tokenMint,
        neonEVMUserATANonce,
        solanaRecipientATAInBytes,
        10 * 10 ** 9 // amount (transfer 10 tokens)
    )

    console.log('\nNeonEVM transaction hash: ' + tx.hash)
    await tx.wait(1) // Wait for 1 confirmation
    txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
    console.log(txReceipt.status, 'txReceipt.status')

    solanaTransactions = (await (await getSolanaTransactions(tx.hash)).json()).result

    console.log('\nSolana transactions signatures:')
    for await (let txId of solanaTransactions) {
        console.log(txId)
    }
    console.log("\n")

    info = await solanaConnection.getTokenAccountBalance(new web3.PublicKey(ethers.encodeBase58(solanaRecipientATAInBytes)));
    console.log('New Solana user ATA balance: ' + info.value.uiAmount)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })