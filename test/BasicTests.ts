import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ErcWrapper__factory } from "../typechain";

import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";
import UniswapV2Router02 from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { ChainId, Token, WETH, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk'


chai.use(solidity);
const { expect } = chai;
var fs = require("fs");

const TOTALSUPPLY = ethers.utils.parseEther("10000");

describe("ErcWrapper", () => {
  let ErcWrapper: Contract;
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let NotListedToken: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  before(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Mint two tokens and send to user1 & user2
    const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
    TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenC = await ERC20Factory.deploy(TOTALSUPPLY);
    NotListedToken = await ERC20Factory.deploy(TOTALSUPPLY);

    // User1 Tokens
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenC.transfer(user1.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user1.address, ethers.utils.parseEther("100"));

    // User2 Transfer
    await TokenB.transfer(user2.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user2.address, ethers.utils.parseEther("100"));

    // Deploy ERCWrapper
    const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
    const wrapperFactory = new ErcWrapper__factory(deployer);
    ErcWrapper = await wrapperFactory.deploy([TokenA.address, TokenB.address], feeds);
  });


  it("Standard wrapping", async function () {
    const toSwap = ethers.utils.parseEther("20");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);

    // Send to contract
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);
    console.log('Successful wrapp with allowed');

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

  it("Wrapping only from allowed list", async function () {
    console.log("Starting wrap with not allowed token");
    const toSwap = ethers.utils.parseEther("20");

    const userTokenB = TokenB.connect(user2);
    const NotAllowedToken = NotListedToken.connect(user2);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

    const userWrapper = ErcWrapper.connect(user2);

    await expect(userWrapper.wrapper([NotAllowedToken.address, TokenB.address], [toSwap, toSwap])).to.be.revertedWith("No Chainlink Price Feed Available");
    const hasTokens = await userWrapper.balanceOf(user2.address);
    console.log("Wrap failed (should), Balance unchanged is:", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);  
  });

  it("Unwrapping", async function () {
    console.log("Starting wrap with not allowed token");
    const NotAllowedUser = ErcWrapper.connect(user2);
    console.log("Owner:", user1.address, "NotAllowed:", user2.address);
    const showOwner = await ErcWrapper.balanceOf(user2.address);
    console.log("Balance of Notallowed:", showOwner.toString(), "Should be 0");

    // WE KNOW USER2 DOESN'T OWN ANY BASKET AND CANNOT UNWRAP NOT OWNED BASKET
    await expect(NotAllowedUser.unwrapper(1), "Old owner shouldn't be able to unwrap").to.be.revertedWith("Not an owner of a basket");
    console.log("Only owner can unwrap (revert)");

    // SUCCEEDS AS SHOULD, USER1 UNWRAPS WRAP1 AND ZEROES BALANCE
    const userWrapper = ErcWrapper.connect(user1);
    const basketId = await userWrapper.ownerOf(1);
    console.log("Owner of basketId 1", basketId.toString());
    await expect(userWrapper.unwrapper(1));
    const hasTokens = await userWrapper.balanceOf(user1.address);
    console.log("Basket unwrapped! Should not own any", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);  
  });

  it("Transfer from U1 to U2", async function () {
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
    await userWrapper.approve(user2.address, 2);
    await userWrapper.transferFrom(user1.address, user2.address, 2);

    // Check User2 Balance
    const userWrapper2 = ErcWrapper.connect(user2);
    const userNFTBalanceAfterTransfer = await userWrapper2.wrappedBalance(2);

    console.log(
      "\nBasket ID (should be 2)",
      userNFTBalanceAfterTransfer.id.toString(),
      "\nBasket Tokens",
      userNFTBalanceAfterTransfer.tokens,
      "\nBasket Tokens Amounts",
      userNFTBalanceAfterTransfer.amounts.toString(),
    );
  });

  it("User1 tries to unwrap already sent Basket", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.unwrapper(1)).to.be.reverted;
    console.log("Unwrapping already unwrapped token revert! Good!");
  });

  it("User1 owns multiple baskets", async function () {
    const toSwap = ethers.utils.parseEther("20");
    const userWrapper = ErcWrapper.connect(user1);
    const userTokenA = TokenA.connect(user1);
    const userTokenB = TokenB.connect(user1);

    // Mints basket 3 & 4
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);
    
    const totalBalance = await userWrapper.balanceOf(user1.address);
    const ownerExample = await userWrapper.ownerOf(3);
    console.log("Owner balance of Baskets", totalBalance.toString(), "\nOwner of Bakset ID3", ownerExample.toString());
  
});

  it("Create order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    let deadline = Date.now() + 300;
    // _wrapId, _deadline, _priceSlip, _premium
    // LOCK FOR CREATING ONLY ONE ORDER FOR GIVEN ID!
    await expect(userWrapper.createOrder(3, deadline, 50000, 10));
    const value = await userWrapper.basketBalance(user1.address, 3);
    console.log("Curent basket Price: (should be non-0)", value.toString());
    console.log("Order created!");

    // Try to transfer basket already locked in Order 
    await expect(userWrapper.approve(user2.address, 3));
    await expect(userWrapper.transferFrom(user1.address, user2.address, 3)).to.be.revertedWith("Cannot transfer locked");
    console.log("Transfer of locked basket fails! Good!")

    // Should try to unwrap now
    await expect(userWrapper.unwrapper(3)).to.be.revertedWith("Cannot unwrap locked");
    console.log("Unwrapping of locked basket fails! Good!")
  });

  it("Fill order", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    const value = await userWrapper.basketBalance(user1.address, 3);
    await userWrapper.fillOrder(user1.address, 3, {value});
    console.log("Order filled!")

    // Should check balances
    // Should call Cancel or balance for user1
  });

  it("Cancel Order", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    let deadline = Date.now() + 300;

    // All wrong structurally
    await expect(userWrapper.createOrder(3, deadline, 50000, 10));
    await expect(userWrapper.cancelOrder(3));
    const value = await userWrapper.basketBalance(user2.address, 3);
    console.log("Buying Basket 3 for", value.toString());

    const Buyer = ErcWrapper.connect(user1);
    await expect(Buyer.fillOrder(user2.address, 3, {value})).to.be.revertedWith("Basket not locked for sale");
    console.log("Can't buy basket with closed order! Good!");

    // Should check balances
    // Should call Cancel or balance for user1

    // Fundamental problem is that, a) Price isn't updated b) Tracking by wrapId is bad in bidding
  });

});
