import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";
const hre = require("hardhat");

var fs = require("fs");

/**
 * Wrapper deployed to:  0x1F6cF4780540D2E829964d0851146feaeA686827
 * Deployer address 0xc3f8e4bC305dcaAbd410b220E0734d4DeA7C0bc9
 * SNX tokA: 0x585477b415Ea1Bc88ABcA26c32755952CF24C631
 * ZRX tokB: 0xa30000D7B0B6b645FAAB3931C02320649f6Bee23
 * BAT tokC: 0x468C26d86c614cC3d8Eb8cFd89D5607f79D46289
 * LINK tokD: 0x9C35eb2Ddf340AD3ac051455ea26D44e1ed87DC9
 * Todo:
 *      Name Mocks Differently (shadow real rinkebyOracle names tSNX)
 *      Verified Contract for ease
 *      Load testLink and change Oracle output (now it's hardcoded bullshit value)
 *      Better structure of rinkebyInteract for multiple use (split functions)
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

    // Connect user1 to TokenA & TokenB
    //   console.log(await hre.artifacts.getArtifactPaths());
    const artifact = await hre.artifacts.readArtifact("MockToken");
    const abi = artifact.abi;
    TokenA = new ethers.Contract("0x585477b415Ea1Bc88ABcA26c32755952CF24C631", abi, user1);
    TokenB = new ethers.Contract("0xa30000D7B0B6b645FAAB3931C02320649f6Bee23", abi, user1);
    TokenC = new ethers.Contract("0x468C26d86c614cC3d8Eb8cFd89D5607f79D46289", abi, user1);
    TokenD = new ethers.Contract("0x9C35eb2Ddf340AD3ac051455ea26D44e1ed87DC9", abi, user1);

    const wArtifcat = await hre.artifacts.readArtifact("ercWrapper");
    const wAbi = wArtifcat.abi;
    ErcWrapper = new ethers.Contract("0x1F6cF4780540D2E829964d0851146feaeA686827", wAbi, user1);

    // await getTokens();
    // await getBalance();
    await wrapMock();
    // await wrapBalance();
    // await transferWrap();
    // await unwrapTransfered();

    async function getTokens() {
        const value = ethers.utils.parseEther("0.01");
        await TokenB.deposit({ value });
    }

    async function getBalance() {
        const balance = await TokenB.balanceOf(user1.address);
        console.log("User1 balance of mock tokenB", ethers.utils.formatEther(balance));
    }

    async function wrapMock() {
        const toSwap = ethers.utils.parseEther("1");

        // Approve two tokens which will become NFT-Index
        await TokenA.approve(ErcWrapper.address, toSwap);
        await TokenB.approve(ErcWrapper.address, toSwap);
    
        // Send to contract
        await ErcWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);
        console.log(user1.address, "created wrap!");
    }

    async function transferWrap() {
        await ErcWrapper.approve(user2.address, 1);
        const tx = await ErcWrapper.transferFrom(user1.address, user2.address, 1);
        console.log('wrap transfered');
        console.log(tx);
    }

    async function unwrapTransfered() {
        let user2_wrapper = new ethers.Contract("0x1F6cF4780540D2E829964d0851146feaeA686827", wAbi, user2);
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
