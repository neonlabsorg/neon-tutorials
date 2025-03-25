// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BondingCurve} from "./BondingCurve.sol";
import {CallSolana} from "./CallSolana.sol";
import {IERC20ForSplFactory} from "./interfaces/IERC20ForSplFactory.sol";
import {IERC20} from "./interfaces/IERC20.sol";

contract TokenFactory is ReentrancyGuard, Ownable, CallSolana {
    using SafeERC20 for IERC20;
    
    enum TokenState {
        NOT_CREATED,
        FUNDING,
        TRADING
    }

    struct ComposabilityRequest {
        uint64[] lamports;
        bytes32[] salt;
        bytes[] instruction;
    }

    struct PayerTokenAccounts {
        bytes32 fundingTokenATA;
        bytes32 memeTokenATA;
    }

    // Token constants
    uint8 public constant TOKEN_DECIMALS = 9;
    uint256 public constant MAX_SUPPLY = 1000000 * (10 ** TOKEN_DECIMALS); // 1 Million tokens with 9 decimals
    uint256 public constant INITIAL_SUPPLY = (MAX_SUPPLY * 1) / 5;
    uint256 public constant FUNDING_SUPPLY = (MAX_SUPPLY * 4) / 5;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // WSOL constants
    uint256 public immutable wsolDecimals;
    uint256 public immutable fundingGoal; // 0.1 WSOL in proper decimals

    // State variables
    mapping(address => TokenState) public tokens;
    mapping(address => uint256) public collateral;
    address public immutable erc20ForSplFactory;
    address public wsolToken;
    BondingCurve public bondingCurve;
    uint256 public feePercent; // basis points
    uint256 public fee;

    // Events
    event TokenCreated(address indexed token, uint256 timestamp);
    event TokenLiqudityAdded(address indexed token, uint256 timestamp);

    constructor(
        address _erc20ForSplFactory,
        address _bondingCurve,
        address _wsolToken,
        uint256 _feePercent
    ) Ownable(msg.sender) {
        erc20ForSplFactory = _erc20ForSplFactory;
        bondingCurve = BondingCurve(_bondingCurve);
        wsolToken = _wsolToken;
        feePercent = _feePercent;
        
        // Get WSOL decimals
        wsolDecimals = IERC20(_wsolToken).decimals();
        
        // Set funding goal to 0.1 SOL (0.1 * 10^9)
        fundingGoal = 10**wsolDecimals / 10;
    }

    // Admin functions

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = BondingCurve(_bondingCurve);
    }

    function setFeePercent(uint256 _feePercent) external onlyOwner {
        feePercent = _feePercent;
    }

    function claimFee() external onlyOwner {
        IERC20(wsolToken).transfer(msg.sender, fee);
        fee = 0;
    }

    // Token functions

    function createToken(
        string memory name,
        string memory symbol
    ) external returns (address) {
        // Create a new token using the factory
        address tokenAddress = IERC20ForSplFactory(erc20ForSplFactory).createErc20ForSplMintable(
            name,
            symbol,
            TOKEN_DECIMALS,
            address(this)
        );
        
        tokens[tokenAddress] = TokenState.FUNDING;
        emit TokenCreated(tokenAddress, block.timestamp);
        return tokenAddress;
    }

    function buy(address tokenAddress, uint256 wsolAmount, ComposabilityRequest calldata composabilityRequest, PayerTokenAccounts calldata payerTokenAccounts) external nonReentrant {
        require(tokens[tokenAddress] == TokenState.FUNDING, "Token not found");
        require(wsolAmount > 0, "WSOL amount not enough");
        
        // Transfer WSOL from user to this contract
        IERC20(wsolToken).transferFrom(msg.sender, address(this), wsolAmount);
    
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
        
        IERC20 token = IERC20(tokenAddress);
        
        uint256 amount = bondingCurve.getAmountOut(
            token.totalSupply(),
            contributionWithoutFee
        );
        
        tokenCollateral += contributionWithoutFee;
        token.mint(msg.sender, amount);
        // When reached FUNDING_GOAL
        if (tokenCollateral >= fundingGoal) {
            
            token.mint(address(this), INITIAL_SUPPLY);
            token.transferSolana(payerTokenAccounts.memeTokenATA, uint64(INITIAL_SUPPLY));
            uint256 fundingTokenLiquidityAmount = IERC20(wsolToken).balanceOf(address(this)) - valueToReturn;
            IERC20(wsolToken).transferSolana(payerTokenAccounts.fundingTokenATA, uint64(fundingTokenLiquidityAmount));
            batchExecute(composabilityRequest.lamports, composabilityRequest.salt, composabilityRequest.instruction);
            tokens[tokenAddress] = TokenState.TRADING;
            emit TokenLiqudityAdded(tokenAddress, block.timestamp);
        }
        collateral[tokenAddress] = tokenCollateral;
        
        // Return any excess WSOL
        if (valueToReturn > 0) {
            IERC20(wsolToken).transfer(msg.sender, valueToReturn);
        }
    }

    function sell(address tokenAddress, uint256 amount) external nonReentrant {
        require(
            tokens[tokenAddress] == TokenState.FUNDING,
            "Token is not funding"
        );
        require(amount > 0, "Amount should be greater than zero");
        
        IERC20 token = IERC20(tokenAddress);
        
        uint256 fundsReceived = bondingCurve.getFundsReceived(
            token.totalSupply(),
            amount
        );
        
        uint256 _fee = calculateFee(fundsReceived, feePercent);
        uint256 receivedWsol = fundsReceived - _fee;
        fee += _fee;
        
        // Transfer tokens from sender to this contract first
        token.transferFrom(msg.sender, address(this), amount);
        // Then burn them
        token.burn(amount);
        
        collateral[tokenAddress] -= receivedWsol;
        IERC20(wsolToken).transfer(msg.sender, receivedWsol);
    }

    function calculateBuyAmount(address tokenAddress, uint256 wsolAmount) public view returns (
        uint256 amount,
        uint256 availableSupply,
        uint256 totalSupply,
        uint256 normalizedContribution
    ) {
        IERC20 token = IERC20(tokenAddress);
        
        uint256 contributionWithoutFee = wsolAmount * FEE_DENOMINATOR / (FEE_DENOMINATOR + feePercent);
        normalizedContribution = contributionWithoutFee;
        
        amount = bondingCurve.getAmountOut(
            token.totalSupply(),
            normalizedContribution
        );
        
        totalSupply = token.totalSupply();
        availableSupply = FUNDING_SUPPLY - totalSupply;
        
        return (amount, availableSupply, totalSupply, normalizedContribution);
    }

    function calculateFee(
        uint256 _amount,
        uint256 _feePercent
    ) internal pure returns (uint256) {
        return (_amount * _feePercent) / FEE_DENOMINATOR;
    }
} 