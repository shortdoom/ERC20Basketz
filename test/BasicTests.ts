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
    console.log(user1.address, "created wrap!");

    // Check balance after sending (N - toSwap)
    const userTokenBalanceA = await TokenA.balanceOf(user1.address);
    const userTokenBalanceB = await TokenB.balanceOf(user1.address);
    console.log(user1.address, "balance after wraping! (should be 80)");
    console.log("TokenA:", userTokenBalanceA.toString(), "TokenB:", userTokenBalanceB.toString());

    // Number of NFT-Indexes assigned to user account
    const userWrapperBalance = await userWrapper.balanceOf(user1.address);

    // We use wrapId (equal to tokenId from ERC721 also)
    console.log(user1.address, "owns:", userWrapperBalance.toString(), "basket (should be 1)");
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
    console.log("Wrap failed (should), balance of", user2.address, "is:", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);  
  });

  it("Unwrapping", async function () {
    const NotAllowedUser = ErcWrapper.connect(user2);
    console.log("owner:", user1.address, "notAllowed:", user2.address);
    const showOwner = await ErcWrapper.balanceOf(user2.address);
    console.log("balance of notallowed:", showOwner.toString(), "(should be 0)");

    // WE KNOW USER2 DOESN'T OWN ANY BASKET AND CANNOT UNWRAP NOT OWNED BASKET
    await expect(NotAllowedUser.unwrapper(1)).to.be.revertedWith("Not an owner of a basket");
    console.log("Only owner can unwrap (revert)! good!");

    // SUCCEEDS AS SHOULD, USER1 UNWRAPS WRAP1 AND ZEROES BALANCE
    const userWrapper = ErcWrapper.connect(user1);
    const basketId = await userWrapper.ownerOf(1);
    console.log("owner of basketId 1", basketId.toString());
    await expect(userWrapper.unwrapper(1));
    const hasTokens = await userWrapper.balanceOf(user1.address);
    console.log("basket unwrapped! current balance of baskets =", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);
    // show token balance of unwrap caller

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
    console.log("basket transfered from", user1.address, "to", user2.address);
    const basketBalance = await userWrapper2.balanceOf(user2.address);
    console.log(basketBalance.toString(), "baskets owned by", user2.address);
  });

  it("User1 tries to unwrap already sent Basket", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.unwrapper(1)).to.be.reverted;
    console.log("unwrapping already unwrapped token revert! good!");
  });

  it("User2 can unwrap after transfer", async function () {
    // Remember to fix tracking of tokenIds
    const userWrapper = ErcWrapper.connect(user2);
    await userWrapper.unwrapper(2);
    console.log("user2 unwraps basket after transfer! good!");
  });

  it("Show balances", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const b1 = await userWrapper.balanceOf(user1.address);
    const b2 = await userWrapper.balanceOf(user2.address);
    console.log("user1 balanceOf (baskets)", b1.toString(), "user2 balanceOf", b2.toString());
  });

  it("Mint 2 new baskets", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const toSwap = ethers.utils.parseEther("20");
    const userTokenA = TokenA.connect(user1);
    const userTokenB = TokenB.connect(user1);

    console.log("Minting 2 baskets to user1");
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    const b1 = await userWrapper.balanceOf(user1.address);
    const b2 = await userWrapper.balanceOf(user2.address);
    console.log("user1 balanceOf (baskets)", b1.toString(), "user2 balanceOf", b2.toString());
  });

  it("Create Order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const fixedPremium = ethers.utils.parseEther("0.05");
    await userWrapper.createOrder(3, fixedPremium);
    const basketPrice = await userWrapper.basketBalance(user1.address, 3);
    console.log("basket priced at", basketPrice.toString());

    console.log("creating another order to test cancel later");
    await userWrapper.createOrder(4, fixedPremium);
    const basketPrice2 = await userWrapper.basketBalance(user1.address, 4);
    console.log("basket priced at", basketPrice2.toString());
  });

  it("Negative cases for Create Order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const user2Wrapper = ErcWrapper.connect(user2);
    const fixedPremium = ethers.utils.parseEther("0.05");
    await expect(userWrapper.createOrder(3, fixedPremium)).to.be.revertedWith("Basket already listed");
    console.log("no doubling orders!")
    await expect(user2Wrapper.createOrder(3, fixedPremium)).to.be.revertedWith("Not an owner of a basket");
    console.log("only owner can create order!")
  });

  it("Fill Order", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    const value = await userWrapper.basketBalance(user1.address, 3); 
    await userWrapper.fillOrder(user1.address, 3, {value});
    console.log("first order filled by user2")
  });

  it("Cancel Order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.cancelOrder(4);
    console.log("order canceled by user1");
  });

});
