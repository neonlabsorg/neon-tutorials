// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import './TestCallSolana/interfaces/ICallSolana.sol';

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

contract TestAaveFlashLoanWithComposability is FlashLoanSimpleReceiverBase {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    address public immutable uniswapV2Router;
    address public immutable swapTokenIn;
    address public immutable swapTokenOut;
    uint public lastLoan;
    uint public lastLoanFee;

    event ComposabilityResponse(bytes response);

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

    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    function flashLoanSimple(
        address _token, 
        uint256 _amount,
        bytes32 programId,
        bytes memory accountsData,
        bytes memory instruction
    ) public {
        address receiverAddress = address(this);
        address asset = _token;
        uint256 amount = _amount;
        bytes memory params = "";

        // request loan from Aave
        POOL.flashLoanSimple(
            receiverAddress,
            asset,
            amount,
            params,
            0
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
        (bytes32 programId, bytes memory accountsData, bytes memory instruction) = abi.decode(params, (bytes32, bytes, bytes));

        // perform some logic with the loan
        /* address[] memory swapPath1 = new address[](2);
        swapPath1[0] = swapTokenIn;
        swapPath1[1] = swapTokenOut;

        // SWAP USDT -> devUSDC
        IERC20(swapTokenIn).approve(uniswapV2Router, amount);
        uint[] memory amountsOut1 = IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(
            amount,
            0,
            swapPath1,
            address(this),
            block.timestamp + 1800
        ); */

        // SWAP devUSDC -> devSAMO
        _executeComposabilityRequest(0, programId, accountsData, instruction);

        // approval to return back loan + the fee
        IERC20(asset).approve(address(POOL), amount + premium);
        return true;
    }

    function _executeComposabilityRequest(
        uint64 lamports,
        bytes32 programId,
        bytes memory accountsData,
        bytes memory instruction
    ) internal {
        bytes memory response = CALL_SOLANA.execute(
            lamports,
            abi.encodePacked(
                programId, 
                accountsData,
                instruction
            )
        );
        
        emit ComposabilityResponse(response);
    }

    receive() external payable {}
}