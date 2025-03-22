// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Token
 * @dev Simplified implementation of an ERC20-compatible token
 * This contract follows the minimal clone pattern and is designed to work with TokenFactory
 */
contract Token is IERC20, IERC20Metadata {
    bool private _initialized;
    address private _owner;
    
    // Token metadata
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 18; // Standard ERC20 decimals
    
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;
    
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor() {}
    
    /**
     * @dev Modifier to restrict function access to the owner
     */
    modifier onlyOwner() {
        require(msg.sender == _owner, "Token: caller is not the owner");
        _;
    }
    
    /**
     * @dev Returns the owner of the token
     */
    function owner() public view returns (address) {
        return _owner;
    }
    
    /**
     * @dev Transfers ownership of the contract to a new account
     * Can only be called by the current owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Token: new owner is the zero address");
        _transferOwnership(newOwner);
    }
    
    /**
     * @dev Transfers ownership of the contract to a new account
     * Internal function without access restriction
     */
    function _transferOwnership(address newOwner) internal {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Initializes the token with a name and symbol
     * The caller becomes the owner
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol
    ) public {
        require(!_initialized, "Token: already initialized");
        
        // Set token metadata
        _name = tokenName;
        _symbol = tokenSymbol;
        
        // Set the owner to the caller (TokenFactory)
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        
        _initialized = true;
    }

    /**
     * @dev Returns the name of the token
     */
    function name() public view override returns (string memory) {
        return _name;
    }
    
    /**
     * @dev Returns the symbol of the token
     */
    function symbol() public view override returns (string memory) {
        return _symbol;
    }
    
    /**
     * @dev Returns the number of decimals used for token display
     */
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Returns the total supply of the token
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }
    
    /**
     * @dev Returns the balance of the specified address
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }
    
    /**
     * @dev Returns the allowance granted by owner to spender
     */
    function allowance(address tokenOwner, address spender) public view override returns (uint256) {
        return _allowances[tokenOwner][spender];
    }
    
    /**
     * @dev Sets amount as the allowance of spender over the caller's tokens
     */
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Internal function to set the allowance
     */
    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "Token: approve from the zero address");
        require(spender != address(0), "Token: approve to the zero address");
        
        _allowances[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
    
    /**
     * @dev Transfers tokens from the caller to recipient
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    /**
     * @dev Transfers tokens from sender to recipient using the caller's allowance
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }
    
    /**
     * @dev Internal function to update allowance when using transferFrom
     */
    function _spendAllowance(address tokenOwner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(tokenOwner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Token: insufficient allowance");
            unchecked {
                _approve(tokenOwner, spender, currentAllowance - amount);
            }
        }
    }
    
    /**
     * @dev Internal function to transfer tokens
     */
    function _transfer(address from, address to, uint256 amount) internal {
        require(_initialized, "Token: not initialized");
        require(from != address(0), "Token: transfer from the zero address");
        require(to != address(0), "Token: transfer to the zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "Token: transfer amount exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        
        emit Transfer(from, to, amount);
    }

    /**
     * @dev Mints new tokens to the specified address
     * Only the owner (TokenFactory) can call this function
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(_initialized, "Token: not initialized");
        require(to != address(0), "Token: mint to the zero address");
        
        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }
        
        emit Transfer(address(0), to, amount);
    }

    /**
     * @dev Burns tokens from the specified address
     * Only the owner (TokenFactory) can call this function
     */
    function burn(address from, uint256 amount) public onlyOwner {
        require(_initialized, "Token: not initialized");
        require(from != address(0), "Token: burn from the zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "Token: burn amount exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _totalSupply -= amount;
        }
        
        emit Transfer(from, address(0), amount);
    }
} 