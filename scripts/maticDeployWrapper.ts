import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ErcWrapper__factory} from "../typechain";

var fs = require("fs");

const TOTALSUPPLY = ethers.utils.parseEther("10000");

/**
  Wrapper deployed to:  0x1F6cF4780540D2E829964d0851146feaeA686827
  Deployer address 0xc3f8e4bC305dcaAbd410b220E0734d4DeA7C0bc9
 * npx hardhat verify --network kovan --constructor-args scripts/arguments.js 0xac92c3eCEF51276f8F9154e94A55103D2341dE0A
 * https://kovan.etherscan.io/address/0xac92c3eCEF51276f8F9154e94A55103D2341dE0A#code
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

  const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
  const tokens = await fs.readFileSync("scripts/tokens.txt", "utf-8").split('\n');
  const wrapperFactory = new ErcWrapper__factory(deployer);

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
