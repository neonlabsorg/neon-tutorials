// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import './interfaces/ICallSolana.sol';

contract TestCallSolana {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    event LogData(bytes response, bytes32 programId, bytes data);
    event CreateResource(bytes32 salt, uint64 space, uint64 lamports, bytes32 programId, bytes32 response);

    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    function getSolanaPDA(bytes32 program_id, bytes memory seeds) external view returns (bytes32) {
        return CALL_SOLANA.getSolanaPDA(program_id, seeds);
    }

    function getResourceAddress(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getResourceAddress(salt);
    }

    function getExtAuthority(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getExtAuthority(salt);
    }

    function execute(
        bytes32 program_id, 
        ICallSolana.AccountMeta[] memory accounts, 
        bytes memory instruction_data, 
        uint64 lamports,
        bytes32 salt
    ) external {
        _execute(program_id, accounts, instruction_data, lamports, salt);
    }

    function batchExecute(
        bytes32[] memory program_id,
        ICallSolana.AccountMeta[][] memory accounts, 
        bytes[] memory instruction_data, 
        uint64[] memory lamports,
        bytes32[] memory salt
    ) external {
        uint len = program_id.length;
        for (uint i = 0; i < len; ++i) {
            _execute(program_id[i], accounts[i], instruction_data[i], lamports[i], salt[i]);
        }
    }

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

    function _execute(
        bytes32 program_id, 
        ICallSolana.AccountMeta[] memory accounts, 
        bytes memory instruction_data, 
        uint64 lamports,
        bytes32 salt
    ) internal returns(bytes memory, bytes32, bytes memory) {
        ICallSolana.Instruction memory instruction = ICallSolana.Instruction({
            program_id: program_id,
            accounts: accounts,
            instruction_data: instruction_data
        });

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
        (bytes32 programId, bytes memory data) = CALL_SOLANA.getReturnData();
        
        emit LogData(response, programId, data);
        return (response, programId, data);
    }
}