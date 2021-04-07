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
 * SNX tokA: 0x220b45711340265481ACfF4302b5F0e17011503f
   ZRX tokB: 0xfC74e8cb33D36A5b9d6753934549763ddB769BCf
   BAT tokC: 0x26611b182856eDb22883F54583dEA00Fe641AB1A
 * LINK tokD: 0x95d0455390aD9fC57F1DA4525151A63bB407BCf8
   npx hardhat verify --network rinkeby --contract contracts/tokenMock/TokenD.sol:MockTokenD 0x95d0455390aD9fC57F1DA4525151A63bB407BCf8
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
