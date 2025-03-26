const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const fs = require('fs');

// Replace this with your private key from Phantom
const privateKey = "<your-private-key>";

// Create keypair directly from the private key
const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

// Save as id.json
fs.writeFileSync('id.json', JSON.stringify(Array.from(keypair.secretKey)));

console.log('id.json has been created successfully!');
console.log('Make sure to:');
console.log('1. Keep this file secure and never share it');
console.log('2. Set the correct permissions: chmod 600 id.json');
console.log('3. Set the ANCHOR_WALLET environment variable: export ANCHOR_WALLET=./id.json'); 