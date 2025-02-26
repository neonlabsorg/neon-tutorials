// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LibUtils
/// @notice Utils library for data formatting
/// @author maxpolizzo@gmail.com
library LibUtils {
    /// @notice Helper function to format a uint256 value as right-padded little-endian bytes
    /// @param bigEndian The uint256 value to be formatted
    /// @return littleEndian The same value formatted as a right-padded little-endian bytes32
    function convertUintToLittleEndianBytes32(uint256 bigEndian) internal pure returns (bytes32 littleEndian) {
        assembly {
            for {let i := 0} lt(i, 32) {i := add(i, 1)} {
                let nextBEByte := byte(sub(31, i), bigEndian) // Get BE bytes starting from the right
                let nextLEByte := shl(sub(248, mul(i, 8)), nextBEByte) // Shift left to get LE bytes
                littleEndian := add(littleEndian, nextLEByte) // Add LE bytes to return value
            }
        }
    }
}
