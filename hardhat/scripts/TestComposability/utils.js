const {ethers, network} = require("hardhat");
const config = require("./config");

async function asyncTimeout(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timeout);
    })
}

async function airdropNEON(address, amount) {
    const postRequestNeons = await fetch(process.env.NEON_FAUCET, {
        method: 'POST',
        body: JSON.stringify({"amount": amount, "wallet": address}),
        headers: { 'Content-Type': 'application/json' }
    });
    console.log("\nAirdropping " + ethers.formatUnits(amount.toString(), 0) + " NEON to " + address);
    await asyncTimeout(3000);
}

async function deployTestComposabilityContract() {
    const testComposabilityContractFactory = await ethers.getContractFactory("TestComposability")
    let testComposability
    if (!config.testComposability[network.name]) {
        console.log("\nDeploying TestComposability contract to " + network.name + "...")
        testComposability = await testComposabilityContractFactory.deploy()
        await testComposability.waitForDeployment()
        console.log("TestComposability contract deployed to: " + testComposability.target)
    } else {
        console.log("\nTestComposability contract already deployed to: " + config.testComposability[network.name])
        testComposability = testComposabilityContractFactory.attach(config.testComposability[network.name])
    }

    console.log("\n")

    return testComposability
}

async function getSolanaTransactions(neonTxHash) {
    return await fetch(process.env.NEON_EVM_NODE, {
        method: 'POST',
        body: JSON.stringify({
            "jsonrpc":"2.0",
            "method":"neon_getSolanaTransactionByNeonTransaction",
            "params":[neonTxHash],
            "id":1
        }),
        headers: { 'Content-Type': 'application/json' }
    });
}

module.exports = {
    asyncTimeout,
    airdropNEON,
    deployTestComposabilityContract,
    getSolanaTransactions
};