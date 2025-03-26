const {
  CREATE_CPMM_POOL_PROGRAM,
  CREATE_CPMM_POOL_FEE_ACC,
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
} = require("@raydium-io/raydium-sdk-v2");
const BN = require("bn.js");
const { initSdk, txVersion } = require("./config");

const createPool = async () => {
  const raydium = await initSdk({ loadToken: true });

  // Check token list here: https://api-v3.raydium.io/mint/list
  // TNEON3
  const mintA = await raydium.token.getTokenInfo(
    "EJ6Wmsg55NMPfv7X7dQGiRzKdP9BULH8P9sYrfNwCFdL"
  );
  // WSOL
  const mintB = await raydium.token.getTokenInfo(
    "So11111111111111111111111111111111111111112"
  );
  console.log(mintA, mintB);

  const feeConfigs = await raydium.api.getCpmmConfigs();

  if (raydium.cluster === "devnet") {
    feeConfigs.forEach((config) => {
      config.id = getCpmmPdaAmmConfigId(
        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
        config.index
      ).publicKey.toBase58();
    });
  }

  const { execute, extInfo, builder } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
    mintA,
    mintB,
    mintAAmount: new BN(4000000),
    mintBAmount: new BN(1000000000),
    startTime: new BN(0),
    feeConfig: feeConfigs[0],
    associatedOnly: false,
    ownerInfo: {
      useSOLBalance: true,
    },
    txVersion,
  });

  console.log(builder, "createRaydiumPool");

  const { txId } = await execute({ sendAndConfirm: false });
  console.log("Pool created", {
    txId,
    poolKeys: Object.keys(extInfo.address).reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: extInfo.address[cur].toString(),
      }),
      {}
    ),
  });
  process.exit();
};

/** Uncomment code below to execute */
createPool();

module.exports = { createPool };
