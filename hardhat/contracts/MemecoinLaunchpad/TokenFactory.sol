// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BondingCurve} from "./BondingCurve.sol";
import {CallSolana} from "./CallSolana.sol";
import {IERC20ForSplFactory} from "./interfaces/IERC20ForSplFactory.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title TokenFactory
/// @notice Factory contract for creating and managing memecoin tokens with Raydium integration
/// @dev Implements a funding mechanism with bonding curve and Raydium pool creation
contract TokenFactory is ReentrancyGuard, Ownable, CallSolana {
    using SafeERC20 for IERC20;
    
    /// @notice Represents the current state of a token
    /// @dev NOT_CREATED: Token hasn't been created yet
    /// @dev FUNDING: Token is in funding phase
    /// @dev TRADING: Token has reached funding goal and is trading on Raydium
    enum TokenState {
        NOT_CREATED,
        FUNDING,
        TRADING
    }

    /// @notice Structure for composability request parameters
    /// @param lamports Array of lamport amounts for Solana transactions
    /// @param salt Array of salt values for transaction uniqueness
    /// @param instruction Array of instructions to execute
    struct ComposabilityRequest {
        uint64[] lamports;
        bytes32[] salt;
        bytes[] instruction;
    }

    /// @notice Structure for payer token accounts
    /// @param fundingTokenATA Funding token Associated Token Account
    /// @param memeTokenATA Meme token Associated Token Account
    struct PayerTokenAccounts {
        bytes32 fundingTokenATA;
        bytes32 memeTokenATA;
    }

    // Token constants
    uint8 public constant TOKEN_DECIMALS = 9;
    /// @notice Maximum token supply (1 Million tokens)
    uint256 public constant MAX_SUPPLY = 1000000 * (10 ** TOKEN_DECIMALS);
    /// @notice Initial supply for liquidity pool (20% of max supply)
    uint256 public constant INITIAL_SUPPLY = (MAX_SUPPLY * 1) / 5;
    /// @notice Supply available for funding phase (80% of max supply)
    uint256 public constant FUNDING_SUPPLY = (MAX_SUPPLY * 4) / 5;
    /// @notice Denominator for fee calculations (10000 = 100%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice WSOL token decimals
    uint256 public immutable wsolDecimals;
    /// @notice Funding goal in WSOL (0.1 WSOL)
    uint256 public immutable fundingGoal;

    /// @notice Mapping of token address to its current state
    mapping(address => TokenState) public tokens;
    /// @notice Mapping of token address to its current collateral amount
    mapping(address => uint256) public collateral;
    /// @notice Address of the ERC20ForSplFactory contract
    address public immutable erc20ForSplFactory;
    /// @notice Address of the WSOL token
    address public wsolToken;
    /// @notice Address of the BondingCurve contract
    BondingCurve public bondingCurve;
    /// @notice Fee percentage in basis points
    uint256 public feePercent;
    /// @notice Accumulated fees
    uint256 public fee;

    /// @notice Emitted when a new token is created
    /// @param token Address of the newly created token
    /// @param timestamp Time of token creation
    event TokenCreated(address indexed token, uint256 timestamp);
    /// @notice Emitted when liquidity is added to a token's Raydium pool
    /// @param token Address of the token
    /// @param timestamp Time of liquidity addition
    event TokenLiqudityAdded(address indexed token, uint256 timestamp);

    /// @notice Constructor for TokenFactory
    /// @param _erc20ForSplFactory Address of the ERC20ForSplFactory contract
    /// @param _bondingCurve Address of the BondingCurve contract
    /// @param _wsolToken Address of the WSOL token
    /// @param _feePercent Fee percentage in basis points
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
        
        wsolDecimals = IERC20(_wsolToken).decimals();
        fundingGoal = 10**wsolDecimals / 10; // 0.1 SOL
    }

    /// @notice Updates the bonding curve contract address
    /// @param _bondingCurve New bonding curve contract address
    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = BondingCurve(_bondingCurve);
    }

    /// @notice Updates the fee percentage for token operations
    /// @param _feePercent New fee percentage in basis points
    function setFeePercent(uint256 _feePercent) external onlyOwner {
        feePercent = _feePercent;
    }

    /// @notice Withdraws accumulated fees to the owner
    function claimFee() external onlyOwner {
        IERC20(wsolToken).transfer(msg.sender, fee);
        fee = 0;
    }

    /// @notice Creates a new token with the specified name and symbol
    /// @param name Token name
    /// @param symbol Token symbol
    /// @return Address of the newly created token
    function createToken(
        string memory name,
        string memory symbol
    ) external returns (address) {
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

    /// @notice Buys tokens during the funding phase. If funding goal is reached, creates Raydium pool
    /// @param tokenAddress Address of the token to buy
    /// @param wsolAmount Amount of WSOL to spend
    /// @param composabilityRequest Parameters for Solana transaction composability
    /// @param payerTokenAccounts Token account addresses for the payer
    function buy(
        address tokenAddress, 
        uint256 wsolAmount, 
        ComposabilityRequest calldata composabilityRequest, 
        PayerTokenAccounts calldata payerTokenAccounts
    ) external nonReentrant {
        require(tokens[tokenAddress] == TokenState.FUNDING, "Token not found");
        require(wsolAmount > 0, "WSOL amount not enough");
        
        IERC20(wsolToken).transferFrom(msg.sender, address(this), wsolAmount);
    
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
        
        if (valueToReturn > 0) {
            IERC20(wsolToken).transfer(msg.sender, valueToReturn);
        }
    }

    /// @notice Sells tokens back during the funding phase
    /// @param tokenAddress Address of the token to sell
    /// @param amount Amount of tokens to sell
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
        
        token.transferFrom(msg.sender, address(this), amount);
        token.burn(amount);
        
        collateral[tokenAddress] -= receivedWsol;
        IERC20(wsolToken).transfer(msg.sender, receivedWsol);
    }

    /// @notice Calculates the amount of tokens to receive for a given WSOL amount
    /// @param tokenAddress Address of the token
    /// @param wsolAmount Amount of WSOL to spend
    /// @return amount Amount of tokens to receive
    /// @return availableSupply Available supply for funding
    /// @return totalSupply Current total supply
    /// @return normalizedContribution Contribution amount after fee calculation
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

    /// @notice Calculates the fee amount for a given value and fee percentage
    /// @param _amount Value to calculate fee for
    /// @param _feePercent Fee percentage in basis points
    /// @return Calculated fee amount
    function calculateFee(
        uint256 _amount,
        uint256 _feePercent
    ) internal pure returns (uint256) {
        return (_amount * _feePercent) / FEE_DENOMINATOR;
    }
} 