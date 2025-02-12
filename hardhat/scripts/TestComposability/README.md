# Solidity libraries for NeonEVM composability

The composability feature allows dApps deployed on _NeonEVM_ to interact with _Solana_ programs, which involves 
formatting instructions in ways that are specific to each program.

Here we provide a set of **Solidity** libraries which make it possible to easily implement secure interactions with 
_Solana_'s **System** and **SPL Token** programs.

This work is an example of what program-specific **Solidity** libraries for _NeonEVM_ composability could look like.

## LibSystemProgram

This library provides helper functions for formatting instructions intended to be executed by _Solana_'s **System** 
program.

## LibSPLTokenProgram

This library provides helper functions for formatting instructions intended to be executed by _Solana_'s **SPL Token** 
program.

## Scripts

The `TestComposability` contract is deployed along with imported libraries at the beginning of each script, unless the 
`config.js` file already contains addresses for these contracts and libraries.

* The `test-create-account-with-seed.js` script lets you format and execute _Solana_'s **System** program 
`createAccountWithSeed` instruction.

* The `test-create-init-token-mint` script lets you format and execute _Solana_'s **SPL Token** program 
`initializeMint2` instruction after creating a SPL token mint account using _NeonEVM_ composability's `createResource` 
method to create the account.

* The `test-create-init-ata` script lets you format and execute _Solana_'s **SPL Token** program 
`initializeAccount2` instruction after creating an associated token account using _NeonEVM_ composability's 
`createResource` method to create the account. Make sure run the `test-create-init-token-mint` script first on the same
`TestComposability` contract instance before running this script.

* The `test-mint-tokens` script lets you format and execute _Solana_'s **SPL Token** program
`mintTo` instruction, minting SPL tokens to a recipient's associated token account. Make sure run the 
`test-create-init-token-mint` and `test-create-init-ata` scripts first on the same `TestComposability` contract instance
before running this script.


