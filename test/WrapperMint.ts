import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ErcWrapper__factory } from "../typechain";

import ERC20 from "@uniswap/v2-periphery/build/ERC20.json"

chai.use(solidity);
const { expect } = chai;

const TOTALSUPPLY = ethers.utils.parseEther("10000");

describe("ErcWrapper", () => {
    let ErcWrapper: Contract;
    let TokenA: Contract;
    let TokenB: Contract;
    let deployer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
  
    beforeEach(async () => {
      [deployer, user1, user2] = await ethers.getSigners();

      const wrapperFactory = new ErcWrapper__factory(deployer);
      ErcWrapper = await wrapperFactory.deploy();

      // Mint two tokens and send to user1 & user2
      const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
      TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
      TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
      await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
      await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));

    });

    it("Basic Mint Basket", async function() {
        const toSwap = ethers.utils.parseEther("20");

        // Approve two tokens which will become NFT-Index
        const userTokenA = TokenA.connect(user1);
        await userTokenA.approve(ErcWrapper.address, toSwap);
        const userTokenB = TokenB.connect(user1);
        await userTokenB.approve(ErcWrapper.address, toSwap);

        // Send to contract
        const userWrapper = ErcWrapper.connect(user1);
        await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

        // Check balance after sending (N - toSwap)
        const userTokenBalanceA = await TokenA.balanceOf(user1.address);
        const userTokenBalanceB = await TokenB.balanceOf(user1.address);
        console.log('Balance after minting first Basket');
        console.log('TokenA:', userTokenBalanceA.toString(), 'TokenB:', userTokenBalanceB.toString());

        // Number of NFT-Indexes assigned to user account
        const userWrapperBalance = await userWrapper.balanceOf(user1.address);
        console.log("User1 owns:", userWrapperBalance.toString(), "Basket (should be 1)");

        const wrappedBalance = await userWrapper.wrappedBalance();
        
        console.log(
            "Basket ID",
            wrappedBalance.id.toString(),
            "\nBasket Tokens",
            wrappedBalance.tokens, 
            "\nBasket Tokens amounts",
            wrappedBalance.amounts.toString()
            );
    });

    it("Transfer NFT from U1 to U2, remove from U1 account", async function() {
        const toSwap = ethers.utils.parseEther("20");

        // Approve two tokens which will become NFT-Index
        const userTokenA = TokenA.connect(user1);
        await userTokenA.approve(ErcWrapper.address, toSwap);
        const userTokenB = TokenB.connect(user1);
        await userTokenB.approve(ErcWrapper.address, toSwap);

        // Create Basket for User1
        const userWrapper = ErcWrapper.connect(user1);
        await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

        // Transfer Basket from User1 to User2
        await userWrapper.approve(user2.address, 1);
        await userWrapper.transferFrom(user1.address, user2.address, 1);

        // Check User2 Balance
        const userWrapper2 = ErcWrapper.connect(user2);
        const userNFTBalanceAfterTransfer = await userWrapper2.wrappedBalance();

        console.log(
            "\nBasket ID (should be 1)",
            userNFTBalanceAfterTransfer.id.toString(),
            "\nBasket Tokens",
            userNFTBalanceAfterTransfer.tokens, 
            "\nBasket Tokens Amounts",
            userNFTBalanceAfterTransfer.amounts.toString()
            );
        
        // Check User1 Balance
        const userNFTBalanceAfterTransferOriginal = await userWrapper.wrappedBalance();

        console.log(
            "\nBasket ID (should be 0)",
            userNFTBalanceAfterTransferOriginal.id.toString(),
            "\nBasket Tokens",
            userNFTBalanceAfterTransferOriginal.tokens, 
            "\nBasket Tokens Amounts",
            userNFTBalanceAfterTransferOriginal.amounts.toString()
            );

    });

    it("Basic Unwrap of Basket", async function() {
        const toSwap = ethers.utils.parseEther("20");

        // Approve two tokens which will become NFT-Index
        const userTokenA = TokenA.connect(user1);
        await userTokenA.approve(ErcWrapper.address, toSwap);
        const userTokenB = TokenB.connect(user1);
        await userTokenB.approve(ErcWrapper.address, toSwap);

        // Create Basket for User1
        const userWrapper = ErcWrapper.connect(user1);
        await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

        // Unwrap Basket of User1
        await userWrapper.unwrapper();
        console.log('Unwrapping!');

        // Should be 100 Tokens (80+20)
        const userTokenBalanceA_after = await TokenA.balanceOf(user1.address);
        const userTokenBalanceB_after = await TokenB.balanceOf(user1.address);
        console.log('Balance of TokenA after unwrapping:', userTokenBalanceA_after.toString(), 'Balance of TokenB after unwrapping:', userTokenBalanceB_after.toString());

        const userNFTBalanceAfterTransfer = await userWrapper.wrappedBalance();

        console.log(
            "\nUSER1 BASKET DATA\n",
            "\nShould be null now!\n",
            "\nBasket ID",
            userNFTBalanceAfterTransfer.id.toString(),
            "\nBasket Tokens",
            userNFTBalanceAfterTransfer.tokens, 
            "\nBasket Tokens Amounts",
            userNFTBalanceAfterTransfer.amounts.toString()
            );

    });
});
  
