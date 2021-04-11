import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const hre = require("hardhat");

var fs = require("fs");

/**
 * Wrapper deployed to:  0xac92c3eCEF51276f8F9154e94A55103D2341dE0A
 * Deployer address 0xc3f8e4bC305dcaAbd410b220E0734d4DeA7C0bc9
 * SNX tokA: 0x468C26d86c614cC3d8Eb8cFd89D5607f79D46289
 * ZRX tokB: 0x9C35eb2Ddf340AD3ac051455ea26D44e1ed87DC9
 * BAT tokC: 0x1F6cF4780540D2E829964d0851146feaeA686827
 * LINK tokD: 0x7aAE0b58df51A346182a11294e4Af42EEB3dA4c0
 */

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

    // Connect user1 to TokenA, TokenB, TokenC & TokenD

    const artifactA = await hre.artifacts.readArtifact("MockTokenA");
    const artifactB = await hre.artifacts.readArtifact("MockTokenB");
    const artifactC = await hre.artifacts.readArtifact("MockTokenC");
    const artifactD = await hre.artifacts.readArtifact("MockTokenD");
    const abiA = artifactA.abi;
    const abiB = artifactB.abi;
    const abiC = artifactC.abi;
    const abiD = artifactD.abi;

    TokenA = new ethers.Contract("0x585477b415Ea1Bc88ABcA26c32755952CF24C631", abiA, user1);
    TokenB = new ethers.Contract("0xa30000D7B0B6b645FAAB3931C02320649f6Bee23", abiB, user1);
    TokenC = new ethers.Contract("0x468C26d86c614cC3d8Eb8cFd89D5607f79D46289", abiC, user1);
    TokenD = new ethers.Contract("0x9C35eb2Ddf340AD3ac051455ea26D44e1ed87DC9", abiD, user1);

    const wArtifcat = await hre.artifacts.readArtifact("ercWrapper");
    const wAbi = wArtifcat.abi;
    ErcWrapper = new ethers.Contract("0x1F6cF4780540D2E829964d0851146feaeA686827", wAbi, user1);

    /** Uncomment depending on what action with smart contract you want to perform */

    await getTokens();
    await getBalance();
    // await wrapMock();
    // await wrapBalance();
    // await transferWrap();
    // await unwrapTransfered();

    // await createOrderBasket();
    // await fillOrderBasket();
    // await cancelOrderBasket();

    async function createOrderBasket() {
        const premium = ethers.utils.parseEther("0.09");
        ErcWrapper.createOrder(1, premium);
    }

    async function fillOrderBasket() {
        const value = ethers.utils.parseEther("1");
        ErcWrapper.fillOrder(user1.address, 1, {value});
    }

    async function cancelOrderBasket() {
        ErcWrapper.cancelOrder(user1.address, 1);
    }

    async function getTokens() {
        const value = ethers.utils.parseEther("0.01");
        await TokenA.deposit({ value });
        await TokenB.deposit({ value });
        await TokenC.deposit({ value });
        await TokenD.deposit({ value });
        console.log("tokA and tokB transfered to user1");
    }

    async function getBalance() {
        const balance = await TokenB.balanceOf(user1.address);
        console.log("User1 balance of mock tokenB", ethers.utils.formatEther(balance));
    }

    async function wrapMock() {
        const toSwap = ethers.utils.parseEther("19");

        // Approve two tokens which will become NFT-Index
        await TokenA.approve(ErcWrapper.address, toSwap);
        await TokenB.approve(ErcWrapper.address, toSwap);
        await TokenC.approve(ErcWrapper.address, toSwap);
        await TokenD.approve(ErcWrapper.address, toSwap);
        console.log("Tokens approved");
    
        // Send to contract
        const tx = await ErcWrapper.wrapper([TokenA.address, TokenB.address, TokenC.address, TokenD.address], [toSwap, toSwap, toSwap, toSwap]);
        console.log(user1.address, "created wrap!");
        console.log(tx);
    }

    async function transferWrap() {
        await ErcWrapper.approve(user2.address, 1);
        const tx = await ErcWrapper.transferFrom(user1.address, user2.address, 1);
        console.log('wrap transfered');
        console.log(tx);
    }

    async function unwrapTransfered() {
        let user2_wrapper = new ethers.Contract("0x3163B20A6d9E846728a6dA06D3a4C98BF5a6E6f3", wAbi, user2);
        const tx = await user2_wrapper.unwrapper(1);
        console.log("wrap unwrapped");
        console.log(tx);
    }

    async function wrapBalance() {
        const wrappedBalance = await ErcWrapper.wrappedBalance(1);

        console.log(
          "Basket ID",
          wrappedBalance.id.toString(),
          "\nBasket Tokens",
          wrappedBalance.tokens,
          "\nBasket Tokens amounts",
          wrappedBalance.amounts.toString(),
        );
    
    }

}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
