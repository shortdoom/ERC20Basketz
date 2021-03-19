import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";

var fs = require("fs");

async function main(): Promise<void> {
  let WrapperContract: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  [owner, user1, user2] = await ethers.getSigners();
  const feeds = await generateFeeds();
  const tokens = await generateTokens();

  const ERCWrapper: ContractFactory = await ethers.getContractFactory("ercWrapper");
  const ercwrapper: Contract = await ERCWrapper.deploy(feeds, tokens);
  await ercwrapper.deployed();
  console.log("Wrapper deployed to: ", ercwrapper.address);

  async function generateFeeds() {
    const arr = [fs.readFileSync("feeds.txt", "utf-8")];
    return (arr);

  }

  async function generateTokens() {
    return (["token adddress"])
  }

}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
