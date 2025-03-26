const {
  CREATE_CPMM_POOL_PROGRAM,
  DEV_CREATE_CPMM_POOL_PROGRAM,
} = require("@raydium-io/raydium-sdk-v2");

const VALID_PROGRAM_ID = new Set([
  CREATE_CPMM_POOL_PROGRAM.toBase58(),
  DEV_CREATE_CPMM_POOL_PROGRAM.toBase58(),
]);

const isValidCpmm = (id) => VALID_PROGRAM_ID.has(id);

module.exports = { isValidCpmm };
