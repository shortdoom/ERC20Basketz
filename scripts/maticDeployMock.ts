import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { MockTokenA__factory } from "../typechain";
import { MockTokenB__factory } from "../typechain";
import { MockTokenC__factory } from "../typechain";
import { MockTokenD__factory } from "../typechain";


/**
 * Mock ERC20 infinte supply token to use with myContract using LINK price feeds 
 * Get token using testnet ETH by calling deposit(). Exchange ETH at rate 0.01>n = 1000 Tokens.
 * Tokens are whitelisted in myContract.
 * PRICE FEEDS FOR SNX, ZRX, BAT, LINK
  SNX tokA: 0x585477b415Ea1Bc88ABcA26c32755952CF24C631
  ZRX tokB: 0xa30000D7B0B6b645FAAB3931C02320649f6Bee23
  BAT tokC: 0x468C26d86c614cC3d8Eb8cFd89D5607f79D46289
  LINK tokD: 0x9C35eb2Ddf340AD3ac051455ea26D44e1ed87DC9
  npx hardhat verify --network kovan --contract contracts/tokenMock/TokenD.sol:MockTokenD 0x7aAE0b58df51A346182a11294e4Af42EEB3dA4c0
 * 
 */

async function main(): Promise<void> {
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let TokenD: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  [deployer, user1, user2] = await ethers.getSigners();

  const MockFactoryA = new MockTokenA__factory(deployer);
  const MockFactoryB = new MockTokenB__factory(deployer);
  const MockFactoryC = new MockTokenC__factory(deployer);
  const MockFactoryD = new MockTokenD__factory(deployer);

  TokenA = await MockFactoryA.deploy();
  TokenB = await MockFactoryB.deploy();
  TokenC = await MockFactoryC.deploy();
  TokenD = await MockFactoryD.deploy();

  console.log("SNX tokA:", TokenA.address);
  console.log("ZRX tokB:", TokenB.address);
  console.log("BAT tokC:", TokenC.address);
  console.log("LINK tokD:", TokenD.address);

  // await testUser();

  async function testUser() {

    const getTokenA = await TokenA.connect(user1);
    const getTokenB = await TokenB.connect(user1);
    const value = ethers.utils.parseEther("0.01");

    await getTokenA.deposit({ value });
    await getTokenB.deposit({ value });
    const balance = await getTokenA.balanceOf(user1.address);
    console.log("User1 balance of mock tokenA", ethers.utils.formatEther(balance));
  }

}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
