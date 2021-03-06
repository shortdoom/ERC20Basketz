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

    it("Mint Basket", async function() {
        // approve ErcWrapper (transferFrom)
        // call wrapper()
        const toSwap = ethers.utils.parseEther("20");

        const userTokenA = TokenA.connect(user1);
        await userTokenA.approve(ErcWrapper.address, toSwap);

        const userTokenB = TokenB.connect(user1);
        await userTokenB.approve(ErcWrapper.address, toSwap);

        const userWrapper = ErcWrapper.connect(user1);
        await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

        const userTokenBalanceA = await TokenA.balanceOf(user1.address);
        const userTokenBalanceB = await TokenB.balanceOf(user1.address);
        console.log('Balance TokenA:', userTokenBalanceA.toString(), 'Balance TokenB:', userTokenBalanceB.toString());

        const userWrapperBalance = await userWrapper.balanceOf(user1.address);
        console.log("No. of NFT wrapps in user account", userWrapperBalance.toString());

        const wrappedBalance = await userWrapper.wrappedBalance();
        console.log(
            "NFT ID",
            wrappedBalance.id.toString(),
            "\nNFT Tokens",
            wrappedBalance.tokens, 
            "\nNFT Tokens Amounts",
            wrappedBalance.amounts.toString()
            );


    });

    it("Send Basket", async function() {
        // user1 transfers wrapped nft to user2
    });

    it("Unwrapp Basket", async function() {
        // user2 unwrapps and pays his addresses
        // user1 shouldn't be able to do that
    });

});
  