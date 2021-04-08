import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";
import { ErcWrapper__factory} from "../typechain";

var fs = require("fs");

const TOTALSUPPLY = ethers.utils.parseEther("10000");

/**
 * Wrapper deployed to:  0x95d0455390aD9fC57F1DA4525151A63bB407BCf8
 * Deployer address 0xc3f8e4bC305dcaAbd410b220E0734d4DeA7C0bc9
 * npx hardhat verify --network kovan --constructor-args scripts/arguments.js 0x95d0455390aD9fC57F1DA4525151A63bB407BCf8
 * https://kovan.etherscan.io/address/0x95d0455390aD9fC57F1DA4525151A63bB407BCf8#code
 */

async function main(): Promise<void> {
  let ErcWrapper: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  [deployer, user1, user2] = await ethers.getSigners();

  const balance = await deployer.getBalance("latest");
  console.log("Balance", ethers.utils.formatEther(balance));
  console.log("Owner", deployer.address);

  // Create separate config for rinkeby
  const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
  const tokens = await fs.readFileSync("scripts/tokens.txt", "utf-8").split('\n');
  const wrapperFactory = new ErcWrapper__factory(deployer);

  // Rinkeby has only USD feeds
  // Remember to also use RINKEBY tokens address
  ErcWrapper = await wrapperFactory.deploy(tokens, feeds);
  console.log("Wrapper deployed to: ", ErcWrapper.address);
  console.log("Deployer address", deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
