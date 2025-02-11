const { ethers, network, run } = require("hardhat")
const web3 = require("@solana/web3.js");
const { ACCOUNT_SIZE, TOKEN_PROGRAM_ID } = require("@solana/spl-token")
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

    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed");

    const rentExemptBalance = await solanaConnection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
    const seed = 'seed' + Date.now().toString();
    const basePubKey = await testComposability.getNeonAddress(testComposability.target);
    const createWithSeedAccount = await testComposability.getCreateWithSeedAccount(
        basePubKey,
        TOKEN_PROGRAM_ID.toBuffer(),
        Buffer.from(seed)
    );
    console.log(ethers.encodeBase58(createWithSeedAccount), 'createWithSeedAccount')

    console.log('\nCalling testComposability.testCreateAccountWithSeed: ')

    // Here we create a SPL token account
    let tx = await testComposability.testCreateAccountWithSeed(
        TOKEN_PROGRAM_ID.toBuffer(), // SPL token program
        Buffer.from(seed),
        ACCOUNT_SIZE, // SPL token account data size
        rentExemptBalance  // SPL token account minimum balance for rent exemption
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
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })