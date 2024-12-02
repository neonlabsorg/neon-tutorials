// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    getAccount
} = require('@solana/spl-token');
const { config } = require('../TestCallSolana/config');
const { AnchorProvider } = require("@coral-xyz/anchor");
const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, swapQuoteByInputToken, IGNORE_CACHE, getAllWhirlpoolAccountsForConfig, WhirlpoolIx, SwapUtils } = require("@orca-so/whirlpools-sdk");
const { DecimalUtil, Percentage } = require("@orca-so/common-sdk");
const { Decimal } = require("decimal.js");

// devSAMO - 0xd53306d7e87c16bf24c6cc086f108980c5ca9fca
// devUSDC - 0x146c38c2e36d34ed88d843e013677cce72341794

async function main() {
    const [owner] = await ethers.getSigners();
    console.log(owner, 'owner');

    let tx;
    let TestAaveFlashLoanAddress = '0x5fF8f34d9FC468b020073C996D4284A75FDaa63F';
    //let TestAaveFlashLoanAddress = '0x7c92229B20Cb727B6Cf017c9DE77968F8c5300D6';
    let ERC20ForSPL;
    // sepolia
    /* const tokenAddress = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8';
    const aaveAddressProvider = '0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A'; */

    // neondevnet
    const tokenAddress = '0x6eEf939FC6e2B3F440dCbB72Ea81Cd63B5a519A5'; // USDT
    const aaveAddressProvider = '0xe9f46d67eF44abf6f404316ec5A9E7fa013Ba049';
    const uniswapV2Router = '0x491FFC6eE42FEfB4Edab9BA7D5F3e639959E081B';
    const swapTokenOut = '0x512E48836Cd42F3eB6f50CEd9ffD81E0a7F15103'; // USDC

    ERC20ForSPL = await ethers.getContractAt('contracts/TestCallSolana/interfaces/IERC20.sol:IERC20', tokenAddress);

    let TestAaveFlashLoan;
    if (!ethers.isAddress(TestAaveFlashLoanAddress)) {
        TestAaveFlashLoan = await ethers.deployContract("TestAaveFlashLoanWithComposability", [
            aaveAddressProvider,
            uniswapV2Router,
            tokenAddress,
            swapTokenOut
        ]);
        await TestAaveFlashLoan.waitForDeployment();

        console.log(
            `TestAaveFlashLoan token deployed to ${TestAaveFlashLoan.target}`
        );
        TestAaveFlashLoanAddress = TestAaveFlashLoan.target;
    } else {
        TestAaveFlashLoan = await ethers.getContractAt('TestAaveFlashLoanWithComposability', TestAaveFlashLoanAddress);
    }

    /* tx = await owner.sendTransaction({
        to: TestAaveFlashLoan.target,
        value: ethers.parseUnits('20', 'ether')
    });
    await tx.wait(1);
    console.log('sent to contract NEONs'); */

    /* tx = await ERC20ForSPL.transfer(TestAaveFlashLoan.target, 2 * 10 ** 6);
    await tx.wait(1);
    console.log('sent to contract ERC20ForSPLs'); */

    console.log(await TestAaveFlashLoan.lastLoan(), 'lastLoan');
    console.log(await TestAaveFlashLoan.lastLoanFee(), 'lastLoanFee');

    let WHIRLPOOLS_CONFIG = new web3.PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");
    let TokenA = {mint: new web3.PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9}; // devSAMO
    let TokenB = {mint: new web3.PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6}; // devUSDC
    let tickSpacing = 64;
    let amountIn = new Decimal('0.1');
    const connection = new web3.Connection('https://api.devnet.solana.com', "processed");
    const provider = AnchorProvider.env();
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);

    const contractPublicKeyInBytes = await TestAaveFlashLoan.getNeonAddress(TestAaveFlashLoanAddress);
    const contractPublicKey = ethers.encodeBase58(contractPublicKeyInBytes);
    console.log(contractPublicKey, 'contractPublicKey');

    const whirlpool_pubkey = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        WHIRLPOOLS_CONFIG,
        TokenA.mint,
        TokenB.mint,
        tickSpacing // tick spacing
    ).publicKey;
    console.log(whirlpool_pubkey, 'whirlpool_pubkey');
    const whirlpool = await client.getPool(whirlpool_pubkey);
    console.log(whirlpool, 'whirlpool');
    
    const ataContractTokenA = await getAssociatedTokenAddress(
        TokenA.mint,
        new web3.PublicKey(contractPublicKey),
        true
    );

    const ataContractTokenB = await getAssociatedTokenAddress(
        TokenB.mint,
        new web3.PublicKey(contractPublicKey),
        true
    );

    const quote = await swapQuoteByInputToken(
        whirlpool,
        TokenA.mint,
        DecimalUtil.toBN(amountIn, TokenA.decimals), // Input Token Mint amount
        Percentage.fromFraction(10, 1000), // Acceptable slippage (10/1000 = 1%)
        ctx.program.programId,
        ctx.fetcher,
        IGNORE_CACHE
    );

    // Output the estimation
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, TokenA.decimals).toString(), "TokenA");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, TokenB.decimals).toString(), "TokenB");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, TokenB.decimals).toString(), "TokenB");

    // Prepare the swap instruction
    const orcaSwapInstruction = WhirlpoolIx.swapIx(
        ctx.program,
        SwapUtils.getSwapParamsFromQuote(
            quote,
            ctx,
            whirlpool,
            ataContractTokenA,
            ataContractTokenB,
            new web3.PublicKey(contractPublicKey)
        )
    );
    console.log(orcaSwapInstruction.instructions[0], 'orcaSwapInstruction');

    tx = await TestAaveFlashLoan.flashLoanSimple(
        tokenAddress, 
        1 * 10 ** 6,
        config.utils.publicKeyToBytes32(orcaSwapInstruction.instructions[0].programId.toBase58()),
        config.utils.prepareInstructionAccounts(orcaSwapInstruction.instructions[0]),
        config.utils.prepareInstructionData(orcaSwapInstruction.instructions[0])
    );
    await tx.wait(1);
    console.log(tx, 'tx');

    console.log(await TestAaveFlashLoan.lastLoan(), 'lastLoan');
    console.log(await TestAaveFlashLoan.lastLoanFee(), 'lastLoanFee');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});