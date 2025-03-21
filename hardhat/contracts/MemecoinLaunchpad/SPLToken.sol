// SPDX-License-Identifier: MIT

pragma solidity >= 0.7.0;
pragma abicoder v2;

interface SPLToken {
    struct Mint {
        bool isInitialized;
        uint8 decimals;
        uint64 supply;
    }

    struct Account {
        bytes32 mint;
        uint64 amount;
    }

    function getMint(bytes32 mint) external view returns (Mint memory);
    function getAccount(bytes32 account) external view returns (Account memory);
    function isSystemAccount(bytes32 account) external view returns (bool);
    function findAccount(bytes32 seed) external pure returns (bytes32);
    function initializeMint(bytes32 seed, uint8 decimals) external returns (bytes32);
    function initializeAccount(bytes32 seed, bytes32 mint) external returns (bytes32);
    function transfer(bytes32 from, bytes32 to, uint64 amount) external;
    function transferWithSeed(bytes32 seed, bytes32 from, bytes32 to, uint64 amount) external;
    function transferSolana(bytes32 to, uint64 amount) external;
    function approve(bytes32 from, bytes32 to, uint64 amount) external;
    function revoke(bytes32 from) external;
    function burn(bytes32 mint, bytes32 from, uint64 amount) external;
    function mintTo(bytes32 mint, bytes32 to, uint64 amount) external;
} 