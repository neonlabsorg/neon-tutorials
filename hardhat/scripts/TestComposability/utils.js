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
    let libUtils
    const libUtilsLibraryFactory = await ethers.getContractFactory("LibUtils")
    if (!config.libUtils[network.name]) {
        console.log("\nDeploying LibUtils library to " + network.name + "...")
        libUtils = await libUtilsLibraryFactory.deploy()
        await libUtils.waitForDeployment()
        console.log("LibUtils library deployed to: " + libUtils.target)
    } else {
        console.log("\nLibUtils library already deployed to: " + config.libUtils[network.name])
        libUtils = libUtilsLibraryFactory.attach(config.libUtils[network.name])
    }

    let libSystemProgram
    const libSystemProgramLibraryFactory = await ethers.getContractFactory(
        "LibSystemProgram",
        { libraries: {
                LibUtils: libUtils.target
        }}
    )
    if (!config.libSystemProgram[network.name]) {
        console.log("\nDeploying LibSystemProgram library to " + network.name + "...")
        libSystemProgram = await libSystemProgramLibraryFactory.deploy()
        await libSystemProgram.waitForDeployment()
        console.log("LibSystemProgram library deployed to: " + libSystemProgram.target)
    } else {
        console.log("\nLibSystemProgram library already deployed to: " + config.libSystemProgram[network.name])
        libSystemProgram = libSystemProgramLibraryFactory.attach(config.libSystemProgram[network.name])
    }

    let libSPLTokenProgram
    const libSPLTokenProgramLibraryFactory = await ethers.getContractFactory(
        "LibSPLTokenProgram",
        { libraries: {
                LibUtils: libUtils.target
            }}
    )
    if (!config.libSPLTokenProgram[network.name]) {
        console.log("\nDeploying LibSPLTokenProgram library to " + network.name + "...")
        libSPLTokenProgram = await libSPLTokenProgramLibraryFactory.deploy()
        await libSPLTokenProgram.waitForDeployment()
        console.log("LibSPLTokenProgram library deployed to: " + libSPLTokenProgram.target)
    } else {
        console.log("\nLibSPLTokenProgram library already deployed to: " + config.libSPLTokenProgram[network.name])
        libSPLTokenProgram = libSPLTokenProgramLibraryFactory.attach(config.libSPLTokenProgram[network.name])
    }

    const testComposabilityContractFactory = await ethers.getContractFactory(
        "TestComposability",
        { libraries: {
                LibSystemProgram: libSystemProgram.target,
                LibSPLTokenProgram: libSPLTokenProgram.target,
                // CallSolanaHelperLib: callSolanaHelperLib.target
        }}
    )

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