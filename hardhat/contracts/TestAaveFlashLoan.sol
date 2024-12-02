// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
}

contract TestAaveFlashLoan is FlashLoanSimpleReceiverBase {
    address public uniswapV2Router;
    address public swapTokenIn;
    address public swapTokenOut;
    uint public lastLoan;
    uint public lastLoanFee;
    uint public num = 1;

    constructor(
        address _addressProvider, 
        address _uniswapV2Router,
        address _swapTokenIn,
        address _swapTokenOut
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        uniswapV2Router = _uniswapV2Router;
        swapTokenIn = _swapTokenIn;
        swapTokenOut = _swapTokenOut;
    }

    function flashLoanSimple(address _token, uint256 _amount) public {
        address receiverAddress = address(this);
        address asset = _token;
        uint256 amount = _amount;
        bytes memory params = "";
        uint16 referralCode = 0;

        // request loan from Aave
        POOL.flashLoanSimple(
            receiverAddress,
            asset,
            amount,
            params,
            referralCode
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    )  external override returns (bool) {
        lastLoan = amount;
        lastLoanFee = premium;

        // perform some logic with the loan
        address[] memory swapPath1 = new address[](2);
        swapPath1[0] = swapTokenIn;
        swapPath1[1] = swapTokenOut;

        IERC20(swapTokenIn).approve(uniswapV2Router, amount);
        uint[] memory amountsOut1 = IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(
            amount,
            0,
            swapPath1,
            address(this),
            block.timestamp + 1800
        );

        address[] memory swapPath2 = new address[](2);
        swapPath2[0] = swapTokenOut;
        swapPath2[1] = swapTokenIn;
        IERC20(swapTokenOut).approve(uniswapV2Router, amountsOut1[amountsOut1.length - 1]);
        uint[] memory amountsOut2 = IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(
            amountsOut1[amountsOut1.length - 1],
            0,
            swapPath2,
            address(this),
            block.timestamp + 1800
        );

        // approval to return back loan + the fee
        IERC20(asset).approve(address(POOL), amount + premium);
        return true;
    }

    receive() external payable {}
}