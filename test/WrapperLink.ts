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
  let NotListedToken: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Mint two tokens and send to user1 & user2
    const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
    TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
    NotListedToken = await ERC20Factory.deploy(TOTALSUPPLY);
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user1.address, ethers.utils.parseEther("100"));

    const wrapperFactory = new ErcWrapper__factory(deployer);
    ErcWrapper = await wrapperFactory.deploy(TokenA.address, TokenB.address);

  });

  it("Standard wrapping", async function () {
    const toSwap = ethers.utils.parseEther("20");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    const NotAllowedToken = NotListedToken.connect(user1);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

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

    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    const NotAllowedToken = NotListedToken.connect(user1);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

    await userTokenB.approve(ErcWrapper.address, toSwap);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

    const userWrapper = ErcWrapper.connect(user1);
    await expect(await userWrapper.wrapper([TokenA.address, NotAllowedToken.address], [toSwap, toSwap])).to.be.reverted;
  });

});
