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
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenC.transfer(user1.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user1.address, ethers.utils.parseEther("100"));

    await TokenB.transfer(user2.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user2.address, ethers.utils.parseEther("100"));

    // We don't actually call Chainlink now, so loading any feeds will do
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

  it("Wrapping only from allowed list (Should fail)", async function () {
    console.log("Starting wrap with not allowed token");
    const toSwap = ethers.utils.parseEther("20");

    const userTokenB = TokenB.connect(user2);
    const NotAllowedToken = NotListedToken.connect(user2);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

    const userWrapper = ErcWrapper.connect(user2);

    await expect(userWrapper.wrapper([NotAllowedToken.address, TokenB.address], [toSwap, toSwap])).to.be.revertedWith("No Chainlink Price Feed Available");
    const hasTokens = await userWrapper.balanceOf(user2.address); // So, balance is carried between it!
    console.log("Wrap failed (should), Balance unchanged is:", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);
    console.log("Works");
  
  });

  it("Unwrapping", async function () {
    console.log("Starting wrap with not allowed token");
    const userWrapper = ErcWrapper.connect(user1);
    const user2Wrapper = ErcWrapper.connect(user2);
    const basketId = await userWrapper.ownerOf(1);
    console.log("Owner of basketId 1", basketId.toString());
    console.log("User1:", user1.address, "User2:", user2.address);
    // SHOULD FAIL, WE KNOW USER2 DOESN'T OWN ANY BASKET AND CANNOT UNWRAP NOT OWNED BASKET
    expect(await user2Wrapper.unwrapper(1)).to.be.revertedWith("Not an owner of a basket");
    console.log("Only owner can unwrap (revert)");

    // SUCCEEDS AS SHOULD, USER1 UNWRAPS WRAP1 AND ZEROES BALANCE
    expect(await userWrapper.unwrapper(1));
    const hasTokens = await userWrapper.balanceOf(user1.address); // So, balance is carried between it!
    console.log("Basket unwrapped! Should not own any", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);  
  });



});
