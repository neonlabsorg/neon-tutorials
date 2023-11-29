const { ethers } = require("hardhat");
const { expect } = require("chai");
const web3 = require("@solana/web3.js");
const { PublicKey } = require("@solana/web3.js");
require("dotenv").config();

// define Solana Devnet connection
const connection = new web3.Connection("https://api.devnet.solana.com");

describe('Test init', async function () {
    let owner, user1;
    let ERC721ForSPLAddress;
    let ERC721ForSPL;
    const RECEIPTS_COUNT = 3;
    let ownerTokenIds = [];
    let userTokenIds = [];

    before(async function() {
        [owner, user1] = await ethers.getSigners();

        if (ethers.isAddress(ERC721ForSPLAddress)) {
            console.log('Creating instance of already deployed contract with address ', ERC721ForSPLAddress);
            ERC721ForSPL = await ethers.getContractAt('ERC721ForSPL', ERC721ForSPLAddress);
        } else {
            const ERC721ForSPLFactory = await hre.ethers.getContractFactory('ERC721ForSPL');
            ERC721ForSPL = await upgrades.deployProxy(ERC721ForSPLFactory, [
                'TestNft',
                'TST'
            ], {kind: 'uups'});
            await ERC721ForSPL.waitForDeployment();
            ERC721ForSPLAddress = ERC721ForSPL.target;
            console.log('Creating instance of just now deployed contract with address ', ERC721ForSPL.target);
        }
    });

    it('validate owner', async function () {
        expect(await ERC721ForSPL.owner()).to.eq(owner.address);
    });

    it('mint', async function () {
        const ownerBalance = await ERC721ForSPL.balanceOf(owner.address);

        let tx = await ERC721ForSPL.mint(
            ethers.encodeBytes32String("0"), 
            owner.address, 
            "https://api.cms.neon-labs.org/uploads/slide_3_ecdc4a635e.png"
        );
        let receipt = await tx.wait(RECEIPTS_COUNT);

        const tokenId = receipt.logs[0].args[2];
        ownerTokenIds.push(tokenId);

        expect(await ERC721ForSPL.balanceOf(owner.address)).to.be.greaterThan(ownerBalance);
        expect(await ERC721ForSPL.ownerOf(tokenId)).to.eq(owner.address);
    });

    it('safeMint', async function () {
        const ownerBalance = await ERC721ForSPL.balanceOf(owner.address);

        let tx = await ERC721ForSPL.safeMint(
            ethers.encodeBytes32String("1"), 
            owner.address, 
            "https://api.cms.neon-labs.org/uploads/slide_3_ecdc4a635e.png"
        );
        let receipt = await tx.wait(RECEIPTS_COUNT);

        const tokenId = receipt.logs[0].args[2];
        ownerTokenIds.push(tokenId);

        expect(await ERC721ForSPL.balanceOf(owner.address)).to.be.greaterThan(ownerBalance);
        expect(await ERC721ForSPL.ownerOf(tokenId)).to.eq(owner.address);
    });

    it('safeMint ( with data )', async function () {
        const ownerBalance = await ERC721ForSPL.balanceOf(owner.address);

        let tx = await ERC721ForSPL["safeMint(bytes32,address,string,bytes)"](
            ethers.encodeBytes32String("2"),
            owner.address,
            "https://api.cms.neon-labs.org/uploads/slide_3_ecdc4a635e.png",
            ethers.encodeBytes32String("0")
        );
        let receipt = await tx.wait(RECEIPTS_COUNT);

        const tokenId = receipt.logs[0].args[2];
        ownerTokenIds.push(tokenId);

        expect(await ERC721ForSPL.balanceOf(owner.address)).to.be.greaterThan(ownerBalance);
        expect(await ERC721ForSPL.ownerOf(tokenId)).to.eq(owner.address);
    });

    it('safeTransferFrom ( owner msg.sender )', async function () {
        const ownerBalance = await ERC721ForSPL.balanceOf(owner.address);
        const userBalance = await ERC721ForSPL.balanceOf(user1.address);
        const tokenId = ownerTokenIds[0];

        let tx = await ERC721ForSPL.connect(owner).safeTransferFrom(
            owner.address,
            user1.address,
            tokenId
        );
        await tx.wait(RECEIPTS_COUNT);

        ownerTokenIds.shift();
        userTokenIds.push(tokenId);

        expect(ownerBalance).to.be.greaterThan(await ERC721ForSPL.balanceOf(owner.address));
        expect(await ERC721ForSPL.balanceOf(user1.address)).to.be.greaterThan(userBalance);
        expect(await ERC721ForSPL.ownerOf(tokenId)).to.eq(user1.address);
    });

    it('approve & safeTransferFrom ( user msg.sender )', async function () {
        const ownerBalance = await ERC721ForSPL.balanceOf(owner.address);
        const userBalance = await ERC721ForSPL.balanceOf(user1.address);
        const tokenId = ownerTokenIds[0];

        let tx = await ERC721ForSPL.approve(
            user1.address,
            tokenId
        );
        await tx.wait(RECEIPTS_COUNT);

        tx = await ERC721ForSPL.connect(user1).safeTransferFrom(
            owner.address,
            user1.address,
            tokenId
        );
        await tx.wait(RECEIPTS_COUNT);

        ownerTokenIds.shift();
        userTokenIds.push(tokenId);

        expect(ownerBalance).to.be.greaterThan(await ERC721ForSPL.balanceOf(owner.address));
        expect(await ERC721ForSPL.balanceOf(user1.address)).to.be.greaterThan(userBalance);
        expect(await ERC721ForSPL.ownerOf(tokenId)).to.eq(user1.address);
    });
});