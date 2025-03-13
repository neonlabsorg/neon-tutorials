// SPDX-License-Identifier: MIT

pragma solidity >= 0.7.0;
pragma abicoder v2;

interface Metaplex {
    function isInitialized(bytes32 mint) external view returns (bool);
    function name(bytes32 mint) external view returns (string memory);
    function symbol(bytes32 mint) external view returns (string memory);
    function uri(bytes32 mint) external view returns (string memory);
    function createMetadata(bytes32 mint, string memory name, string memory symbol, string memory uri) external;
} 