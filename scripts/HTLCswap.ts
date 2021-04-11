import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, Bytes, Contract } from "ethers";

var crypto = require('crypto');
var fs = require("fs");
const hre = require("hardhat");


async function main(): Promise<void> {
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let deployer: SignerWithAddress;
    let ErcWrapper: Contract;
    let secret: string;
    let hash: string;
    let u1contractId: Bytes;
    let u2contractId: Bytes;
    let learnedSecret: Bytes;
    let abiA: any;
    let abiB: any;
    let wAbi: any;
    let estimatedGas: BigNumberish;

    [deployer, user1, user2] = await ethers.getSigners();
    const artifactA = await hre.artifacts.readArtifact("MockTokenA");
    const artifactB = await hre.artifacts.readArtifact("MockTokenB");
    const wArtifcat = await hre.artifacts.readArtifact("ercWrapper");
    abiA = artifactA.abi;
    abiB = artifactB.abi;
    wAbi = wArtifcat.abi;

    await genHash();
    await setupSwapU1();
    await setupSwapU2();
    await u1withdraw();
    await u2withdraw();

    async function genHash() {
        const bufToStr = (b: any) => '0x' + b.toString('hex')
        const sha256 = (x: any) =>
          crypto
            .createHash('sha256')
            .update(x)
            .digest()
        
        const random32 = () => crypto.randomBytes(32)
        const newSecretHashPair = () => {
          const secret = random32()
          const hash = sha256(secret)
          return {
            secret: bufToStr(secret),
            hash: bufToStr(hash),
          }
        }
        const hashPair = newSecretHashPair();
        secret = hashPair.secret;
        hash = hashPair.hash;
        console.log('secret:', secret, 'hash:', hash);
    }

    async function setupSwapU1() {
        console.log(user1.address);
        ErcWrapper = new ethers.Contract("0xac92c3eCEF51276f8F9154e94A55103D2341dE0A", wAbi, user1);
        const timeLock2Sec = Date.now() + 2000;
        estimatedGas = await ErcWrapper.estimateGas.approve(ErcWrapper.address, 17);
        await ErcWrapper.approve(ErcWrapper.address, 17, {gasLimit:estimatedGas.toNumber()})

        // SHOULD WORK, WE USED WRONG USER ADDRESS
        const tx = await ErcWrapper.newContract(user2.address, hash, timeLock2Sec, ErcWrapper.address, 17);
        let receipt = await tx.wait();
        let details = receipt.events?.filter((x: any) => { return x.event == "HTLCERC721New" });
        let contractId = details[0].args.contractId;
        u1contractId = contractId;
        console.log("ContractId", contractId);
        console.log("U1 swap");
    }

    async function setupSwapU2() {
        ErcWrapper = new ethers.Contract("0xac92c3eCEF51276f8F9154e94A55103D2341dE0A", wAbi, user2);
        const timeLock2Sec = Date.now() + 2000;
        estimatedGas = await ErcWrapper.estimateGas.approve(ErcWrapper.address, 18);
        await ErcWrapper.approve(ErcWrapper.address, 18, {gasLimit:estimatedGas.toNumber()})
        const tx = await ErcWrapper.newContract(user1.address, hash, timeLock2Sec, ErcWrapper.address, 18);
        let receipt = await tx.wait();
        let details = receipt.events?.filter((x: any) => { return x.event == "HTLCERC721New" });
        let contractId = details[0].args.contractId;
        u2contractId = contractId;
        console.log("ContracId", contractId);
        console.log("U2 swap");
    }

    async function u1withdraw() {
        ErcWrapper = new ethers.Contract("0xac92c3eCEF51276f8F9154e94A55103D2341dE0A", wAbi, user1);
        estimatedGas = await ErcWrapper.estimateGas.withdraw(u2contractId, secret);
        const tx = await ErcWrapper.withdraw(u2contractId, secret, {gasLimit:estimatedGas});
        let receipt = await tx.wait();
        console.log("u1 withdraw");
      }

    async function u2withdraw() {
        ErcWrapper = new ethers.Contract("0xac92c3eCEF51276f8F9154e94A55103D2341dE0A", wAbi, user2);
        const contractArr = await ErcWrapper.getContract(u2contractId, {gasLimit:estimatedGas});
        learnedSecret = contractArr[8];
        console.log("secret", learnedSecret);
        estimatedGas = await ErcWrapper.estimateGas.withdraw(u1contractId, learnedSecret);
        await ErcWrapper.withdraw(u1contractId, learnedSecret, {gasLimit:estimatedGas});
        console.log("u2 withdraw");
    }

}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });

