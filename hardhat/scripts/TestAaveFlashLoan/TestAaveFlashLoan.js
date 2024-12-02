// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

// devSAMO - 0xd53306d7e87c16bf24c6cc086f108980c5ca9fca
// devUSDC - 0x146c38c2e36d34ed88d843e013677cce72341794

async function main() {
    const [owner] = await ethers.getSigners();
    console.log(owner, 'owner');

    let tx;
    let TestAaveFlashLoanAddress = '0x62584B7f8AeF7cF9B71408B6fCfFCE373630ed86';
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
        TestAaveFlashLoan = await ethers.deployContract("TestAaveFlashLoan", [
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
        TestAaveFlashLoan = await ethers.getContractAt('TestAaveFlashLoan', TestAaveFlashLoanAddress);
    }

    /* tx = await owner.sendTransaction({
        to: TestAaveFlashLoan.target,
        value: ethers.parseUnits('20', 'ether')
    });
    await tx.wait(1);
    console.log('sent to contract NEONs'); */

    tx = await ERC20ForSPL.transfer(TestAaveFlashLoan.target, 2 * 10 ** 6);
    await tx.wait(1);
    console.log('sent to contract ERC20ForSPLs');

    console.log(await TestAaveFlashLoan.lastLoan(), 'lastLoan');
    console.log(await TestAaveFlashLoan.lastLoanFee(), 'lastLoanFee');

    tx = await TestAaveFlashLoan.flashLoanSimple(
        tokenAddress, 
        1 * 10 ** 6
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