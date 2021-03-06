import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";

async function main(): Promise<void> {
  const Greeter: ContractFactory = await ethers.getContractFactory("ercWrapper");
  const greeter: Contract = await Greeter.deploy();
  await greeter.deployed();
  console.log("Wrapper deployed to: ", greeter.address);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
