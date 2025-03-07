// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BondingCurve} from "./BondingCurve.sol";
import {Token} from "./Token.sol";
import {IUniswapV2Factory} from "./interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router01} from "./interfaces/IUniswapV2Router01.sol";

contract TokenFactory is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    enum TokenState {
        NOT_CREATED,
        FUNDING,
        TRADING
    }
    
    // Token constants
    uint256 public constant TOKEN_DECIMALS = 18;
    uint256 public constant MAX_SUPPLY = 10 ** 9 * (10 ** TOKEN_DECIMALS); // 1 Billion
    uint256 public constant INITIAL_SUPPLY = (MAX_SUPPLY * 1) / 5;
    uint256 public constant FUNDING_SUPPLY = (MAX_SUPPLY * 4) / 5;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // WSOL constants
    uint256 public immutable wsolDecimals;
    uint256 public immutable fundingGoal; // 0.1 WSOL in proper decimals

    // State variables
    mapping(address => TokenState) public tokens;
    mapping(address => uint256) public collateral;
    address public immutable tokenImplementation;
    address public uniswapV2Router;
    address public uniswapV2Factory;
    address public wsolToken;
    BondingCurve public bondingCurve;
    uint256 public feePercent; // basis points
    uint256 public fee;

    // Events
    event TokenCreated(address indexed token, uint256 timestamp);
    event TokenLiqudityAdded(address indexed token, uint256 timestamp);

    constructor(
        address _tokenImplementation,
        address _uniswapV2Router,
        address _uniswapV2Factory,
        address _bondingCurve,
        address _wsolToken,
        uint256 _feePercent
    ) Ownable(msg.sender) {
        tokenImplementation = _tokenImplementation;
        uniswapV2Router = _uniswapV2Router;
        uniswapV2Factory = _uniswapV2Factory;
        bondingCurve = BondingCurve(_bondingCurve);
        wsolToken = _wsolToken;
        feePercent = _feePercent;
        
        // Get WSOL decimals
        wsolDecimals = IERC20Metadata(_wsolToken).decimals();
        
        // 0.1 = 10^(decimals-1)
        fundingGoal = 10**(wsolDecimals - 1);
    }

    // Admin functions

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = BondingCurve(_bondingCurve);
    }

    function setFeePercent(uint256 _feePercent) external onlyOwner {
        feePercent = _feePercent;
    }

    function claimFee() external onlyOwner {
        IERC20(wsolToken).safeTransfer(msg.sender, fee);
        fee = 0;
    }

    // Token functions

    function createToken(
        string memory name,
        string memory symbol
    ) external returns (address) {
        address tokenAddress = Clones.clone(tokenImplementation);
        Token token = Token(tokenAddress);
        token.initialize(name, symbol);
        tokens[tokenAddress] = TokenState.FUNDING;
        emit TokenCreated(tokenAddress, block.timestamp);
        return tokenAddress;
    }

    function buy(address tokenAddress, uint256 wsolAmount) external nonReentrant {
        require(tokens[tokenAddress] == TokenState.FUNDING, "Token not found");
        require(wsolAmount > 0, "WSOL amount not enough");
        
        // Transfer WSOL from user to this contract
        IERC20(wsolToken).safeTransferFrom(msg.sender, address(this), wsolAmount);
        
        // Calculate fee
        uint256 valueToBuy = wsolAmount;
        uint256 valueToReturn;
        uint256 tokenCollateral = collateral[tokenAddress];

        uint256 remainingWsolNeeded = fundingGoal - tokenCollateral;
        uint256 contributionWithoutFee = valueToBuy * FEE_DENOMINATOR / (FEE_DENOMINATOR + feePercent);
        if (contributionWithoutFee > remainingWsolNeeded) {
            contributionWithoutFee = remainingWsolNeeded;
        }
        uint256 _fee = calculateFee(contributionWithoutFee, feePercent);
        uint256 totalCharged = contributionWithoutFee + _fee;
        valueToReturn = valueToBuy > totalCharged ? valueToBuy - totalCharged : 0;
        fee += _fee;
        
        Token token = Token(tokenAddress);
        
        // Convert WSOL amount to 18 decimals for bonding curve calculation
        uint256 normalizedContribution = contributionWithoutFee;
        if (wsolDecimals != 18) {
            normalizedContribution = contributionWithoutFee * 10**(18 - wsolDecimals);
        }
        
        uint256 amount = bondingCurve.getAmountOut(
            token.totalSupply(),
            normalizedContribution
        );
        
        
        uint256 availableSupply = FUNDING_SUPPLY - token.totalSupply();
        require(amount <= availableSupply, "Token supply not enough");
        tokenCollateral += contributionWithoutFee;
        token.mint(msg.sender, amount);
        
        // When reached FUNDING_GOAL
        if (tokenCollateral >= fundingGoal) {
            token.mint(address(this), INITIAL_SUPPLY);
            address pair = createLiquilityPool(tokenAddress);
            
            // Set aside the fee before adding liquidity
            uint256 liquidityWsol = tokenCollateral - fee;
            
            uint256 liquidity = addLiquidity(
                tokenAddress,
                INITIAL_SUPPLY,
                liquidityWsol
            );
            burnLiquidityToken(pair, liquidity);
            tokenCollateral = 0;
            tokens[tokenAddress] = TokenState.TRADING;
            emit TokenLiqudityAdded(tokenAddress, block.timestamp);
        }
        collateral[tokenAddress] = tokenCollateral;
        
        // Return any excess WSOL
        if (valueToReturn > 0) {
            IERC20(wsolToken).safeTransfer(msg.sender, valueToReturn);
        }
    }

    function sell(address tokenAddress, uint256 amount) external nonReentrant {
        require(
            tokens[tokenAddress] == TokenState.FUNDING,
            "Token is not funding"
        );
        require(amount > 0, "Amount should be greater than zero");
        
        Token token = Token(tokenAddress);
        
        // Calculate WSOL amount with proper decimals
        uint256 fundsReceived18Decimals = bondingCurve.getFundsReceived(
            token.totalSupply(),
            amount
        );
        
        uint256 receivedWsol;
        if (wsolDecimals != 18) {
            receivedWsol = fundsReceived18Decimals / 10**(18 - wsolDecimals);
        } else {
            receivedWsol = fundsReceived18Decimals;
        }
        
        uint256 _fee = calculateFee(receivedWsol, feePercent);
        receivedWsol -= _fee;
        fee += _fee;
        
        token.burn(msg.sender, amount);
        collateral[tokenAddress] -= receivedWsol;
        
        // Transfer WSOL to user
        IERC20(wsolToken).safeTransfer(msg.sender, receivedWsol);
    }

    // Internal functions

    function createLiquilityPool(
        address tokenAddress
    ) internal returns (address) {
        IUniswapV2Factory factory = IUniswapV2Factory(uniswapV2Factory);
        address pair = factory.createPair(tokenAddress, wsolToken);
        return pair;
    }

    function addLiquidity(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 wsolAmount
    ) internal returns (uint256) {
        Token token = Token(tokenAddress);
        IUniswapV2Router01 router = IUniswapV2Router01(uniswapV2Router);
        
        // Approve tokens for router
        token.approve(uniswapV2Router, tokenAmount);
        IERC20(wsolToken).approve(uniswapV2Router, wsolAmount);
        
        // Add liquidity
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            tokenAddress,
            wsolToken,
            tokenAmount,
            wsolAmount,
            tokenAmount,
            wsolAmount,
            address(this),
            block.timestamp
        );
        
        return liquidity;
    }

    function burnLiquidityToken(address pair, uint256 liquidity) internal {
        IERC20(pair).safeTransfer(address(0), liquidity);
    }

    function calculateFee(
        uint256 _amount,
        uint256 _feePercent
    ) internal pure returns (uint256) {
        return (_amount * _feePercent) / FEE_DENOMINATOR;
    }
} 