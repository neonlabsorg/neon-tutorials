const {
  ApiV3PoolInfoStandardItemCpmm,
  DEV_LOCK_CPMM_PROGRAM,
  DEV_LOCK_CPMM_AUTH,
  CpmmKeys,
} = require("@raydium-io/raydium-sdk-v2");
const { initSdk, txVersion } = require("./config");
const { isValidCpmm } = require("./utils");

const lockLiquidity = async () => {
  const raydium = await initSdk();
  const poolId = "3t7cGz8XQDYfxpKRQ6b7mHVJsrLJisC4nLvPJPBhWHuc";

  let poolInfo;
  let poolKeys;
  if (raydium.cluster === "mainnet") {
    // Note: API doesn't support getting devnet pool info, so in devnet we use RPC method
    // If you wish to get pool info from RPC, modify logic accordingly
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    poolInfo = data[0];
    if (!isValidCpmm(poolInfo.programId))
      throw new Error("Target pool is not CPMM pool");
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    console.log("Pool Info:", poolInfo);
    console.log("poolKeys:", poolKeys);
  }

  /** If you already know how much liquidity can be locked, skip fetching account balance */
  await raydium.account.fetchWalletTokenAccounts();
  const lpBalance = raydium.account.tokenAccounts.find(
    (a) => a.mint.toBase58() === poolInfo.lpMint.address
  );
  if (!lpBalance) throw new Error(`You do not have balance in pool: ${poolId}`);

  const { execute, extInfo, builder } = await raydium.cpmm.lockLp({
    programId: DEV_LOCK_CPMM_PROGRAM, // devnet
    authProgram: DEV_LOCK_CPMM_AUTH, // devnet
    poolKeys, // devnet
    poolInfo,
    lpAmount: lpBalance.amount,
    withMetadata: true,
    txVersion,
  });

  console.log(builder, "Lock CPMM Liquidity");
  console.log(extInfo, "Keys");

  /*const { txId } = await execute({ sendAndConfirm: false });
  console.log("LP locked", {
    txId: `https://explorer.solana.com/tx/${txId}?cluster=devnet`,
    extInfo,
  });*/
  process.exit(); // If you don't want to end node execution, comment this line
};

/** Uncomment code below to execute */
lockLiquidity();

module.exports = { lockLiquidity };
