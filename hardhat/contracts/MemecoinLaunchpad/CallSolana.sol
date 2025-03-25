// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import './interfaces/ICallSolana.sol';

/// @title CallSolana
/// @notice Contract for interacting with Solana programs from Neon EVM
contract CallSolana {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    event LogData(bytes response);
    event CreateResource(bytes32 salt, uint64 space, uint64 lamports, bytes32 programId, bytes32 response);

    /// @notice Returns Solana address for Neon address
    /// @dev Calculates as PDA([ACCOUNT_SEED_VERSION, Neon-address], evm_loader_id)
    /// @param _address Neon address to convert
    /// @return Solana address
    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    /// @notice Returns Solana address for payer account
    /// @dev Calculates as PDA([ACCOUNT_SEED_VERSION, "PAYER", msg.sender], evm_loader_id)
    /// @return Solana payer address
    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    /// @notice Returns Solana PDA generated from specified program_id and seeds
    /// @param program_id Solana program ID
    /// @param seeds Seeds for PDA generation
    /// @return Generated PDA
    function getSolanaPDA(bytes32 program_id, bytes memory seeds) external view returns (bytes32) {
        return CALL_SOLANA.getSolanaPDA(program_id, seeds);
    }

    /// @notice Returns Solana address of resource for contracts
    /// @dev Calculates as PDA([ACCONT_SEED_VERSION, "ContractData", msg.sender, salt], evm_loader_id)
    /// @param salt Salt for resource address generation
    /// @return Resource address
    function getResourceAddress(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getResourceAddress(salt);
    }

    /// @notice Returns Solana address of the external authority
    /// @dev Calculates as PDA([ACCOUNT_SEED_VERSION, "AUTH", msg.sender, salt], evm_loader_id)
    /// @param salt Salt for authority address generation
    /// @return External authority address
    function getExtAuthority(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getExtAuthority(salt);
    }

    /// @notice Executes a Solana instruction
    /// @dev Uses PDA for sender to authorize the operation (getNeonAddress(msg.sender))
    /// @param lamports Amount of lamports for new account creation
    /// @param salt Salt for external authority
    /// @param instruction Instruction to execute
    function execute(
        uint64 lamports,
        bytes32 salt,
        bytes memory instruction
    ) external {
        _execute(lamports, salt, instruction);
    }

    /// @notice Executes multiple Solana instructions in batch
    /// @param lamports Array of lamports for each instruction
    /// @param salt Array of salts for each instruction
    /// @param instruction Array of instructions to execute
    function batchExecute(
        uint64[] memory lamports,
        bytes32[] memory salt,
        bytes[] memory instruction
    ) public {
        uint len = instruction.length;
        for (uint i = 0; i < len; ++i) {
            _execute(lamports[i], salt[i], instruction[i]);
        }
    }

    /// @notice Creates a resource with specified parameters
    /// @dev Returns the Solana address of the created resource (see getResourceAddress)
    /// @param salt Salt for resource creation
    /// @param space Space required for the resource
    /// @param lamports Amount of lamports for resource creation
    /// @param program_id Program ID for the resource
    /// @return Created resource address
    function createResource(
        bytes32 salt, 
        uint64 space, 
        uint64 lamports, 
        bytes32 program_id
    ) external returns (bytes32) {
        bytes32 response = CALL_SOLANA.createResource(
            salt, 
            space,
            lamports,
            program_id
        );

        emit CreateResource(salt, space, lamports, program_id, response);
        return response;
    }

    /// @notice Internal function to execute a Solana instruction
    /// @dev Uses either executeWithSeed or execute based on salt value
    /// @param lamports Amount of lamports for new account creation
    /// @param salt Salt for external authority
    /// @param instruction Instruction to execute
    function _execute(
        uint64 lamports,
        bytes32 salt,
        bytes memory instruction
    ) internal {
        bytes memory response;
        if (salt != bytes32(0)) {
            response = CALL_SOLANA.executeWithSeed(
                lamports,
                salt,
                instruction
            );
        } else {
            response = CALL_SOLANA.execute(
                lamports,
                instruction
            );
        }
        
        emit LogData(response);
    }
}