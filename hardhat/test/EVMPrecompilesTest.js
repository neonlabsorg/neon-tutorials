const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EVMPrecompiles", function () {
  let EVMPrecompiles, evmPrecompiles, signer, messageHash, signature, v, r, s;

  before(async function () {
    [signer] = await ethers.getSigners();
    EVMPrecompiles = await ethers.getContractFactory("EVMPrecompiles");
    evmPrecompiles = await EVMPrecompiles.deploy();
    await evmPrecompiles.waitForDeployment();
    console.log("Contract address:", evmPrecompiles.target);
  });

  describe("SignatureVerifier", function () {
    before(async function () {
      const test = "0x512345673440";
      const testBytes = ethers.getBytes(test);
      messageHash = ethers.hashMessage(testBytes);

      //Sign the testBytes
      signature = await signer.signMessage(testBytes);

      const splitSig = ethers.Signature.from(signature);
      v = splitSig.v;
      r = splitSig.r;
      s = splitSig.s;
    });

    it("Should recover the correct address from the signature via EVM precompile 0x01 ecrecover", async function () {
      const recoveredAddress = await evmPrecompiles.recoverSignature(
        messageHash,
        v,
        r,
        s
      );
      expect(recoveredAddress).to.equal(signer.address);
    });
  });

  describe("Hashing using SHA-256", function () {
    it("Should correctly hash a number using SHA-256 via EVM precompile 0x02", async function () {
      const numberToHash = 12345;

      // Perform the hashing via the contract
      const contractHash = await evmPrecompiles.hashSha256(numberToHash);

      // Perform the hashing via ethers.js to compare
      const ethersHash = ethers.solidityPackedSha256(
        ["uint256"],
        [numberToHash]
      );

      expect(contractHash).to.equal(ethersHash);
    });
  });

  describe("Hashing using RIPEMD-160", function () {
    it("Should correctly hash data using RIPEMD-160 via EVM precompile 0x03", async function () {
      const data = ethers.toUtf8Bytes("Test Data");

      // Compute the RIPEMD-160 hash using ethers.js for comparison
      const expectedHash = ethers.ripemd160(data);

      // Call the contract function to compute the hash
      const contractHash = await evmPrecompiles.hashRIPEMD160(data);

      // Assert that the contract's hash matches the expected hash
      expect(contractHash).to.equal(expectedHash);
    });
  });

  describe("Datacopy (identity function)", function () {
    it("Should correctly copy the data using datacopy via EVM precompile 0x04", async function () {
      const inputData = ethers.toUtf8Bytes("Test Data for Datacopy");

      // Call the contract function to copy the data
      const transaction = await evmPrecompiles.callDatacopy(inputData);
      const receipt = await transaction.wait();
      const returnedData = receipt.logs[0].args[0];

      // Assert that the returned data matches the input data
      expect(returnedData).to.equal(ethers.hexlify(inputData));
    });
  });

  // --------------------------------------------------------------------------------- //
  //******** This precompile is still not supported on Neon Devnet and Mainnet *********
  describe("BigModExp function", function () {
    it("Should correctly calculate base^exponent % modulus using the BigModExp precompile 0x05", async function () {
      // Example values
      const base = ethers.zeroPadValue(ethers.toBeHex(2), 32); // Pad 2 to 32 bytes
      const exponent = ethers.zeroPadValue(ethers.toBeHex(10), 32); // Pad 10 to 32 bytes
      const modulus = ethers.zeroPadValue(ethers.toBeHex(100), 32); // Pad 1000 to 32 bytes

      // Call the contract function
      const transaction = await evmPrecompiles.callBigModExp(
        base,
        exponent,
        modulus
      );
      const receipt = await transaction.wait();
      const returnedData = receipt.logs;
      console.log(returnedData);

      // Manually calculate the expected result (2^10 % 1000 = 24), padded to 32 bytes
      const expectedResult = ethers.zeroPadValue(
        ethers.toBeHex(2 ** 10 % 100),
        32
      );

      // Assert that the result matches the expected result
      expect(returnedData).to.equal(expectedResult);
    });
  });
  // ------------------------------------------------------------------------------------ //

  describe("bn256Add function", function () {
    it("Should correctly perform bn256 addition using the precompile 0x06", async function () {
      // Example points on the bn256 curve (use actual valid points for meaningful tests)
      const ax = ethers.zeroPadValue(ethers.toBeHex(1), 32);
      const ay = ethers.zeroPadValue(ethers.toBeHex(2), 32);
      const bx = ethers.zeroPadValue(ethers.toBeHex(1), 32);
      const by = ethers.zeroPadValue(ethers.toBeHex(2), 32);

      // Call the contract function and get the result
      const transaction = await evmPrecompiles.callBn256Add(ax, ay, bx, by);
      const receipt = await transaction.wait(3);
      const returnedData = receipt.logs[0].args[0];

      // Manually calculate the expected result (if known)
      // Replace with the actual expected result for these points if available
      const expectedResult = [
        "0x030644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd3",
        "0x15ed738c0e0a7c92e7845f96b2ae9c0a68a6a449e3538fc7ff3ebf7a5a18a2c4",
      ];

      // Compare the result from the contract with the expected result
      expect(returnedData[0]).to.equal(expectedResult[0]);
      expect(returnedData[1]).to.equal(expectedResult[1]);
    });
  });

  describe("bn256ScalarMul function", function () {
    it("Should correctly perform bn256 scalar multiplication using the precompile 0x07", async function () {
      // Example point and scalar values (use actual valid points and scalars for meaningful tests)
      const x = ethers.zeroPadValue(ethers.toBeHex(1), 32); // Example x-coordinate
      const y = ethers.zeroPadValue(ethers.toBeHex(2), 32); // Example y-coordinate
      const scalar = ethers.zeroPadValue(ethers.toBeHex(3), 32); // Example scalar

      // Call the contract function and get the result
      const transaction = await evmPrecompiles.callBn256ScalarMul(x, y, scalar);
      const receipt = await transaction.wait(3);
      const returnedData = receipt.logs[0].args[0];

      // Manually calculate the expected result (if known)
      // Replace with the actual expected result for these inputs if available
      const expectedResult = [
        "0x0769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0",
        "0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261",
      ];

      // Compare the result from the contract with the expected result
      expect(returnedData[0]).to.equal(expectedResult[0]);
      expect(returnedData[1]).to.equal(expectedResult[1]);
    });
  });

  describe("bn256Pairing function", function () {
    it("Should correctly perform bn256 pairing using the precompile 0x08", async function () {
      // Example valid points in G1 and G2
      // Note: Replace these with actual valid bn256 points for meaningful results
      /*const G1_x = ethers.zeroPadValue(ethers.toBeHex(1), 32);
      const G1_y = ethers.zeroPadValue(ethers.toBeHex(2), 32);
      const G2_x_0 = ethers.zeroPadValue(ethers.toBeHex(2), 32);
      const G2_x_1 = ethers.zeroPadValue(ethers.toBeHex(3), 32);
      const G2_y_0 = ethers.zeroPadValue(ethers.toBeHex(4), 32);
      const G2_y_1 = ethers.zeroPadValue(ethers.toBeHex(5), 32);

      // Concatenate the inputs for one pair (G1, G2)
      const input = ethers.concat([G1_x, G1_y, G2_x_0, G2_x_1, G2_y_0, G2_y_1]);*/

      const G1_x = BigInt(
        "3010198690406615200373504922352659861758983907867017329644089018310584441462"
      );
      const G1_y = BigInt(
        "17861058253836152797273815394432013122766662423622084931972383889279925210507"
      );
      const G2_x_0 = BigInt(
        "2725019753478801796453339367788033689375851816420509565303521482350756874229"
      );
      const G2_x_1 = BigInt(
        "2725019753478801796453339367788033689375851816420509565303521482350756874229"
      );
      const G2_y_0 = BigInt(
        "2512659008974376214222774206987427162027254181373325676825515531566330959255"
      );
      const G2_y_1 = BigInt(
        "2512659008974376214222774206987427162027254181373325676825515531566330959255"
      );

      // Function to convert BigInt to 32-byte hex string (padded)
      function toBytes32(bigint) {
        let hexString = bigint.toString(16);
        while (hexString.length < 64) {
          hexString = "0" + hexString; // Pad with leading zeros if necessary
        }
        return "0x" + hexString;
      }

      console.log(toBytes32(G1_x));

      // Concatenate the inputs for one pair (G1, G2)
      const input = ethers.concat([
        toBytes32(G1_x),
        toBytes32(G1_y),
        toBytes32(G2_x_0),
        toBytes32(G2_x_1),
        toBytes32(G2_y_0),
        toBytes32(G2_y_1),
      ]);
      console.log(input);

      // Call the contract function
      const transaction = await evmPrecompiles.callBn256Pairing(input);
      console.log("Call Result:", transaction);
      const receipt = await transaction.wait();
      const returnedData = receipt.logs[0].args[0];

      // Expected result should be either 0 or 1 (depending on whether the pairing equation holds)
      const expectedResult = ethers.zeroPadValue(ethers.toBeHex(1), 32); // Example result: replace with actual expected output
      expect(returnedData).to.equal(expectedResult);
    });
  });

  describe.only("Blake2F function", function () {
    it("Should correctly call the Blake2F precompile 0x09", async function () {
      const rounds = 12;

      // Properly formatted 32-byte (256-bit) values for `h`
      const h = [
        "0x48c9bdf267e6096a3ba7ca8485ae67bb2bf894fe72f36e3cf1361d5f3af54fa5",
        "0xd182e6ad7f520e511f6c3e2b8c68059b6bbd41fbabd9831f79217e1319cde05b",
      ];

      // Properly formatted 32-byte (256-bit) values for `m`
      const m = [
        "0x6162630000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ];

      // Properly formatted 8-byte (64-bit) values for `t`, padded to 32 bytes
      const t = ["0x0000000003000000", "0x0000000000000000"];
      const f = true;

      // Call the contract function
      const transaction = await evmPrecompiles.callBlake2F(rounds, h, m, t, f);
      const receipt = await transaction.wait();
      const returnedData = receipt.logs[0].args[0];
      console.log(returnedData);

      // Expected output based on the Blake2F function with these parameters
      // (Note: This expected output is just an example; adjust it based on actual expectations)
      const expectedOutput = [
        "0xba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1", // Replace with actual expected bytes32 output
        "0x7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923", // Replace with actual expected bytes32 output
      ];

      expect(returnedData[0]).to.equal(expectedOutput[0]);
      expect(returnedData[1]).to.equal(expectedOutput[1]);
    });
  });

  describe("KZG proof function", function () {
    it("Should correctly call the precompiled contract 0x0a", async function () {});
  });
});
