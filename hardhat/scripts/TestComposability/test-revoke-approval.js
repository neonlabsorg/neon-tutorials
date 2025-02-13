const { ethers, network, run } = require("hardhat")
const web3 = require("@solana/web3.js");
const { airdropNEON, deployTestComposabilityContract, getSolanaTransactions } = require("./utils");
const { createApproveInstruction, getAccount} = require("@solana/spl-token");
const { config } = require("../TestCallSolana/config");

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

    // =================================== Delegate deployer ATA to NeonEVM user ====================================

    const tokenMint = await testComposability.tokenMint()
    const contractPublicKeyInBytes = await testComposability.getNeonAddress(testComposability.target)
    const deployerATAInBytes = await testComposability.getAssociatedTokenAccount(
        tokenMint,
        deployer.address,
        255
    );
    const neonEVMUser = (await ethers.getSigners())[1]
    const neonEVMUserPublicKeyInBytes = await testComposability.getNeonAddress(neonEVMUser)
    let solanaTransaction = new web3.Transaction();

    const approveIx = createApproveInstruction(
        new web3.PublicKey(ethers.encodeBase58(deployerATAInBytes)), // ATA to delegate
        new web3.PublicKey(ethers.encodeBase58(neonEVMUserPublicKeyInBytes)), // Delegate
        new web3.PublicKey(ethers.encodeBase58(contractPublicKeyInBytes)), // ATA owner
        1000 * 10 ** 9 // Delegate 1000 tokens
    )

    solanaTransaction.add(approveIx)

    let tx, receipt
    [tx, receipt] = await config.utils.execute(
        solanaTransaction.instructions[0],
        0,
        testComposability,
        undefined,
        deployer
    );

    let info = await getAccount(solanaConnection, new web3.PublicKey(ethers.encodeBase58(deployerATAInBytes)))
    console.log(info, 'Deployer ATA info after approval')

    // =================================== Revoke all delegation from deployer ATA ====================================

    const deployerATANonce = 255 // This must be the same nonce that was used to create the sender's ATA through
    // the TestComposability contract

    console.log('\nCalling testComposability.testRevokeApproval: ')

    tx = await testComposability.connect(deployer).testRevokeApproval(
        tokenMint,
        deployerATANonce
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

    info = await getAccount(solanaConnection, new web3.PublicKey(ethers.encodeBase58(deployerATAInBytes)))
    console.log(info, 'Deployer ATA info after revoke')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })