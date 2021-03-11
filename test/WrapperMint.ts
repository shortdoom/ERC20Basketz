import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ErcWrapper__factory } from "../typechain";

import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";

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

  it("Basic Mint Basket", async function () {
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
    console.log("Balance after minting first Basket");
    console.log("TokenA:", userTokenBalanceA.toString(), "TokenB:", userTokenBalanceB.toString());

    // Number of NFT-Indexes assigned to user account
    const userWrapperBalance = await userWrapper.balanceOf(user1.address);

    // This returns len
    console.log("User1 owns:", userWrapperBalance.toString(), "Basket (should be 1)");
    const wrappedBalance = await userWrapper.wrappedBalance(1);

    console.log(
      "Basket ID",
      wrappedBalance.id.toString(),
      "\nBasket Tokens",
      wrappedBalance.tokens,
      "\nBasket Tokens amounts",
      wrappedBalance.amounts.toString(),
    );
  });

  it("Transfer NFT from U1 to U2, remove from U1 account", async function () {
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
    const userNFTBalanceAfterTransfer = await userWrapper2.wrappedBalance(1);

    console.log(
      "\nBasket ID (should be 1)",
      userNFTBalanceAfterTransfer.id.toString(),
      "\nBasket Tokens",
      userNFTBalanceAfterTransfer.tokens,
      "\nBasket Tokens Amounts",
      userNFTBalanceAfterTransfer.amounts.toString(),
    );
    
    // NOTE: Retrive _wrapId/tokenId by msg.sender/address

  });

  it("Basic Unwrap of Basket", async function () {
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
    await userWrapper.unwrapper(1);
    console.log("Unwrapping!");

    // Should be 100 Tokens (80+20)
    const userTokenBalanceA_after = await TokenA.balanceOf(user1.address);
    const userTokenBalanceB_after = await TokenB.balanceOf(user1.address);
    console.log(
      "Balance of TokenA after unwrapping:",
      userTokenBalanceA_after.toString(),
      "Balance of TokenB after unwrapping:",
      userTokenBalanceB_after.toString(),
    );

    // const userNFTBalanceAfterTransfer = await userWrapper.wrappedBalance(1); // This fails because user doesn't own any basket anymore! EXPECT REVERT
    await expect(userWrapper.wrappedBalance(1), "Token burned already").to.be.reverted;
    console.log("User with this Id already burned");
  });

  it("User1 tries to unwrap already sent Basket", async function () {
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
    const userNFTBalanceAfterTransfer = await userWrapper2.wrappedBalance(1);

    console.log(
      "\nUser2 Basket ID (should be 1)",
      userNFTBalanceAfterTransfer.id.toString(),
      "\nBasket Tokens",
      userNFTBalanceAfterTransfer.tokens,
      "\nBasket Tokens Amounts",
      userNFTBalanceAfterTransfer.amounts.toString(),
    );

    // User1 tries to unwrap
    // ERROR HERE: User1 can still unwrap, problem in _transfer
    await expect(userWrapper.unwrapper(1), "Old owner shouldn't be able to unwrap").to.be.reverted;
    console.log("Unwrapping! (should fail)");

    // User2 tries to unwrap
    await userWrapper2.unwrapper(1);
    console.log("Unwrapping! (should succeed)");
  });

  it("User1 owns multiple baskets", async function () {
    const toSwap = ethers.utils.parseEther("20");
    const toSwap2 = ethers.utils.parseEther("2");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);

    // Create Basket1 for User1
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    // Create Basket2 for User1
    await userTokenA.approve(ErcWrapper.address, toSwap2);
    await userTokenB.approve(ErcWrapper.address, toSwap2);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap2, toSwap2]);

    // Number of NFT-Indexes assigned to user account
    const userWrapperBalance = await userWrapper.balanceOf(user1.address);
    console.log("User1 owns:", userWrapperBalance.toString(), "Basket (should be 2)");

    // Should be possible to return totalBaskets owned by address
    const wrappedBalance = await userWrapper.wrappedBalance(1);

    console.log(
      "Basket ID",
      wrappedBalance.id.toString(),
      "\nBasket Tokens",
      wrappedBalance.tokens,
      "\nBasket Tokens amounts",
      wrappedBalance.amounts.toString(),
    );

    const wrappedBalanceB2 = await userWrapper.wrappedBalance(2);

    console.log(
      "Basket ID",
      wrappedBalanceB2.id.toString(),
      "\nBasket Tokens",
      wrappedBalanceB2.tokens,
      "\nBasket Tokens amounts",
      wrappedBalanceB2.amounts.toString(),
    );
  });
});
