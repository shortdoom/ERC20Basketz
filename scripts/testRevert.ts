import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";
import { ErcWrapper__factory} from "../typechain";

import chai from "chai";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
const { expect } = chai;

var fs = require("fs");

const TOTALSUPPLY = ethers.utils.parseEther("10000");

async function main(): Promise<void> {
  let ErcWrapper: Contract;
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let TokenD: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  [deployer, user1, user2] = await ethers.getSigners();

  // Mint two tokens and send to user1 & user2
  const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
  TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
  TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
  TokenC = await ERC20Factory.deploy(TOTALSUPPLY);
  TokenD = await ERC20Factory.deploy(TOTALSUPPLY);

  // User1 Tokens
  await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
  await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
  
  // User2 Transfer
  await TokenC.transfer(user2.address, ethers.utils.parseEther("100"));
  await TokenD.transfer(user2.address, ethers.utils.parseEther("100"));
  
  // Deploy ERCWrapper
  const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
  const wrapperFactory = new ErcWrapper__factory(deployer);
  ErcWrapper = await wrapperFactory.deploy([TokenA.address, TokenB.address, TokenC.address, TokenD.address], feeds);
  console.log("Wrapper deployed to: ", ErcWrapper.address);

  await wrapperCreate();
  await expectRevert();

  async function wrapperCreate() {
    console.log("Start wraping");
    const toSwap = ethers.utils.parseEther("20");
    const toSwap2 = ethers.utils.parseEther("11");

    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);


    const u1balance = await userWrapper.wrappedBalance(1);
    console.log("u1 basket balance before swapping");
    console.log(
      "Basket ID",
      u1balance.id.toString(),
      "\nBasket Tokens",
      u1balance.tokens,
      "\nBasket Tokens amounts",
      u1balance.amounts.toString(),
    );
  }

  async function expectRevert() {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.wrappedBalance(2)).to.be.revertedWith("call revert exception");
    console.log("Error");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
