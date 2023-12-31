// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

interface ISPLToken {
    enum AccountState {
        Uninitialized,
        Initialized,
        Frozen
    }

    struct Account {
        bytes32 mint;
        bytes32 owner;
        uint64 amount;
        bytes32 delegate;
        uint64 delegated_amount;
        bytes32 close_authority;
        AccountState state;
    }

    struct Mint {
        uint64 supply;
        uint8 decimals;
        bool isInitialized;
        bytes32 freezeAuthority;
        bytes32 mintAuthority;
    }

    // Getter returing the Solana account address in bytes32 format
    function findAccount(bytes32 salt) external pure returns(bytes32);

    // check if account is system account
    // Note - system account is not owned by anyone, not owned also by Solana program
    function isSystemAccount(bytes32 account) external view returns(bool);

    // Return spl_token account data. This function checks the account is owned by correct spl_token.
    // Return default not initialized spl_token account data if corresponded Solana account doesn't exist.
    function getAccount(bytes32 account) external view returns(Account memory);

    // Return spl_token mint data. This function checks the mint is owned by correct spl_token.
    // Returns the default spl_token mint data which is not initialized if corresponding Solana account doesn't exist.
    function getMint(bytes32 account) external view returns(Mint memory);

    // Mints new SPL token and returns the Solana token address in bytes32 format.
    // Note - First Solana instruction to call before anything else in the SPL token mint process
    function initializeMint(bytes32 salt, uint8 decimals) external returns(bytes32);

    // Mints new SPL token and returns the Solana token address in bytes32 format, authority needed.
    // Note - First Solana instruction to call before anything else in the SPL token mint process
    function initializeMint(bytes32 salt, uint8 decimals, bytes32 mint_authority, bytes32 freeze_authority) external returns(bytes32);

    // Creates a Solana account, no signer needed.
    function initializeAccount(bytes32 salt, bytes32 mint) external returns(bytes32);

    // Creates a Solana account, signer needed.
    function initializeAccount(bytes32 salt, bytes32 mint, bytes32 owner) external returns(bytes32);

    // Close a token account
    function closeAccount(bytes32 account) external;

    // Mint SPL tokens to an account
    function mintTo(bytes32 mint, bytes32 account, uint64 amount) external;

    // Burn SPL tokens from an account
    function burn(bytes32 mint, bytes32 account, uint64 amount) external;

    // Approve a delegate to transfer up to a maximum number of SPL tokens from an account
    // Note - In Solana you could've a maximum of 1 delegate
    function approve(bytes32 source, bytes32 target, uint64 amount) external;

    // Revoke approval for the transfer of SPL tokens from an account
    function revoke(bytes32 source) external;

    // Transfer SPL tokens from one account to another
    function transfer(bytes32 source, bytes32 target, uint64 amount) external;

    // transfer funds from spl-token accounts owned by Solana user.
    // This method uses PDA[ACCOUNT_SEED_VERSION, b"AUTH", msg.sender, seed] to authorize transfer
    function transferWithSeed(bytes32 seed, bytes32 source, bytes32 target, uint64 amount) external;

    // freeze token account
    function freeze(bytes32 mint, bytes32 account) external;

    // unfreeze token account
    function thaw(bytes32 mint, bytes32 account) external;
}