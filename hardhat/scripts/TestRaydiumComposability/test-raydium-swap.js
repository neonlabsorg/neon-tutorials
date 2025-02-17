const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const { makeSwapInstruction } = require("@raydium-io/raydium-sdk-v2");
const { owner, getPoolKeys, getSwapATAs } = require("./config");

async function main() {
    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed")

    const swapConfig = {
        user: owner,
        tokenIn: "37jexVqVGrrT7erf7wSHTar5NJCvZTQ6otjgarffNNfX", // TRT
        tokenOut: "So11111111111111111111111111111111111111112", // WSOL
        tokenInAmount: 10000000000, // Swap 10 TRT for WSOL
        allowedSlippage: 1 // %
    };

    // Knowing market's base and quote mints, get pool keys
    const baseMint = new web3.PublicKey(swapConfig.tokenOut);
    const quoteMint = new web3.PublicKey(swapConfig.tokenIn);
    const poolKeys = await getPoolKeys(baseMint, quoteMint)

    // console.log(poolKeys, 'poolKeys')

    const isDirectionIn = baseMint.toBase58() === swapConfig.tokenIn
        && quoteMint.toBase58() === swapConfig.tokenOut
    console.log(isDirectionIn, 'isDirectionIn')

    const { tokenIn_ATA, tokenOut_ATA } = await getSwapATAs(swapConfig)

    console.log(tokenIn_ATA.toBase58(), "tokenIn_ATA")
    console.log(tokenOut_ATA.toBase58(), "tokenOut_ATA")

    // const { minAmountOut, amountIn } = await config.raydiumHelper.calcAmountOut(connection, poolKeys, swapConfig.tokenAAmount, directionIn, swapConfig.slippage);

    const ins = makeSwapInstruction({
        poolKeys: poolKeys,
        userKeys: {
            tokenAccountIn: tokenIn_ATA,
            tokenAccountOut: tokenOut_ATA,
            owner: owner
        },
        amountIn: swapConfig.tokenInAmount,
        // amountOut: minAmountOut.raw, // ??
        fixedSide: "in"
    });

    console.log('Processing execute method with Raydium\'s swap instruction ...');
    const solanaTx = new web3.Transaction();
    solanaTx.add(ins.innerTransaction.instructions[0]);

    console.log('Sign, broadcast and confirm transaction...');
    const signature = await web3.sendAndConfirmTransaction(
        connection,
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