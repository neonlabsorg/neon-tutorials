const { ethers } = require("hardhat")
const web3 = require("@solana/web3.js")
const { Liquidity } = require('@raydium-io/raydium-sdk')
const { owner, getPoolKeys, getSwapATAs, getAmountOut } = require("./config")

async function main() {
    const solanaConnection = new web3.Connection(process.env.SOLANA_NODE, "processed")

    const swapConfig = {
        user: owner,
        tokenIn: "37jexVqVGrrT7erf7wSHTar5NJCvZTQ6otjgarffNNfX", // TRT
        tokenOut: "So11111111111111111111111111111111111111112", // WSOL
        tokenInAmount: 10, // Swap 10 TRT for WSOL
        allowedSlippagePct: 5 // Allow for 5% slippage 10000000000
    }

    // Knowing market's base and quote mints, get pool keys
    const baseMint = new web3.PublicKey(swapConfig.tokenIn)
    const quoteMint = new web3.PublicKey(swapConfig.tokenOut)
    const poolKeys = await getPoolKeys(baseMint, quoteMint)

    console.log(poolKeys, 'poolKeys')

    const isDirectionIn = baseMint.toBase58() === swapConfig.tokenIn
        && quoteMint.toBase58() === swapConfig.tokenOut
    console.log(isDirectionIn, 'isDirectionIn')

    const { tokenIn_ATA, tokenOut_ATA } = await getSwapATAs(swapConfig)

    console.log(tokenIn_ATA.toBase58(), "tokenIn_ATA")
    console.log(tokenOut_ATA.toBase58(), "tokenOut_ATA")

    const { amountIn, minAmountOut } = await getAmountOut(
        poolKeys,
        swapConfig.tokenInAmount,
        isDirectionIn,
        swapConfig.allowedSlippagePct
    )
    console.log(amountIn.raw.toString(), 'amountIn')
    console.log(minAmountOut.raw.toString(), 'minAmountOut')

    const ins = Liquidity.makeSwapInstruction({
        poolKeys: poolKeys,
        userKeys: {
            tokenAccountIn: tokenIn_ATA,
            tokenAccountOut: tokenOut_ATA,
            owner: owner.publicKey
        },
        amountIn: amountIn.raw,
        amountOut: minAmountOut.raw,
        fixedSide: isDirectionIn ? "in" : "out"
    })

    console.log('Processing execute method with Raydium\'s swap instruction ...')
    const solanaTx = new web3.Transaction()
    solanaTx.add(ins.innerTransaction.instructions[0])

    console.log('Sign, broadcast and confirm transaction...')
    const signature = await web3.sendAndConfirmTransaction(
        solanaConnection,
        solanaTx,
        [owner],
    )
    console.log('Signature: ', signature)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})