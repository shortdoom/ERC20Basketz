import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const hre = require("hardhat");

var fs = require("fs");

/**
 * Wrapper deployed to:  0x192874ecc528Bda7C70B2109FcE581F47BAf5DD7
 * Deployer address 0xc3f8e4bC305dcaAbd410b220E0734d4DeA7C0bc9
 * SNX tokA: 0x220b45711340265481ACfF4302b5F0e17011503f
   ZRX tokB: 0xfC74e8cb33D36A5b9d6753934549763ddB769BCf
   BAT tokC: 0x26611b182856eDb22883F54583dEA00Fe641AB1A
 * LINK tokD: 0x95d0455390aD9fC57F1DA4525151A63bB407BCf8
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

    // Connect user1 to TokenA, TokenB, TokenC & TokenD

    const artifactA = await hre.artifacts.readArtifact("MockTokenA");
    const artifactB = await hre.artifacts.readArtifact("MockTokenB");
    const artifactC = await hre.artifacts.readArtifact("MockTokenC");
    const artifactD = await hre.artifacts.readArtifact("MockTokenD");
    const abiA = artifactA.abi;
    const abiB = artifactB.abi;
    const abiC = artifactC.abi;
    const abiD = artifactD.abi;

    TokenA = new ethers.Contract("0x220b45711340265481ACfF4302b5F0e17011503f", abiA, user1);
    TokenB = new ethers.Contract("0xfC74e8cb33D36A5b9d6753934549763ddB769BCf", abiB, user1);
    TokenC = new ethers.Contract("0x26611b182856eDb22883F54583dEA00Fe641AB1A", abiC, user1);
    TokenD = new ethers.Contract("0x95d0455390aD9fC57F1DA4525151A63bB407BCf8", abiD, user1);

    const wArtifcat = await hre.artifacts.readArtifact("ercWrapper");
    const wAbi = wArtifcat.abi;
    ErcWrapper = new ethers.Contract("0x468a4D465cb4693306359d0D1bFE0A8E8337ba42", wAbi, user1);

    /** Uncomment depending on what action with smart contract you want to perform */

    // await getTokens();
    // await getBalance();
    await wrapMock();
    // await wrapBalance();
    // await transferWrap();
    // await unwrapTransfered();

    // await createOrderBasket();
    // await fillOrderBasket();
    // await cancelOrderBasket();

    async function getTokens() {
        const value = ethers.utils.parseEther("0.01");
        await TokenA.deposit({ value });
        await TokenB.deposit({ value });
        console.log("tokA and tokB transfered to user1");
    }

    async function getBalance() {
        const balance = await TokenB.balanceOf(user1.address);
        console.log("User1 balance of mock tokenB", ethers.utils.formatEther(balance));
    }

    async function wrapMock() {
        const toSwap = ethers.utils.parseEther("0.1");

        // Approve two tokens which will become NFT-Index
        await TokenA.approve(ErcWrapper.address, toSwap);
        await TokenB.approve(ErcWrapper.address, toSwap);
        console.log("Tokens approved");
    
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
