import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Bytes, Contract } from "ethers";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ErcWrapper__factory} from "../typechain";

import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";

chai.use(solidity);
const { expect } = chai;

var fs = require("fs");
var crypto = require('crypto');

const TOTALSUPPLY = ethers.utils.parseEther("10000");

describe("ErcWrapper", () => {
  let ErcWrapper: Contract;
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let NotListedToken: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  before(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Mint two tokens and send to user1 & user2
    const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
    TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenC = await ERC20Factory.deploy(TOTALSUPPLY);
    NotListedToken = await ERC20Factory.deploy(TOTALSUPPLY);

    // User1 Tokens
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenC.transfer(user1.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user1.address, ethers.utils.parseEther("100"));

    // User2 Transfer
    await TokenB.transfer(user2.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user2.address, ethers.utils.parseEther("100"));

    // Deploy ERCWrapper
    const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
    const wrapperFactory = new ErcWrapper__factory(deployer);
    ErcWrapper = await wrapperFactory.deploy([TokenA.address, TokenB.address], feeds);
  });


  it("Standard wrapping", async function () {
    const toSwap = ethers.utils.parseEther("20");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);

    // Send to contract
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);
    console.log(user1.address, "created wrap!");

    // Check balance after sending (N - toSwap)
    const userTokenBalanceA = await TokenA.balanceOf(user1.address);
    const userTokenBalanceB = await TokenB.balanceOf(user1.address);
    console.log(user1.address, "balance after wraping! (should be 80)");
    console.log("TokenA:", userTokenBalanceA.toString(), "TokenB:", userTokenBalanceB.toString());

    // Number of NFT-Indexes assigned to user account
    const userWrapperBalance = await userWrapper.balanceOf(user1.address);

    // We use wrapId (equal to tokenId from ERC721 also)
    console.log(user1.address, "owns:", userWrapperBalance.toString(), "basket (should be 1)");
    const wrappedBalance = await userWrapper.wrappedBalance(1);

    console.log(
      "Basket ID",
      wrappedBalance.id.toString(),
      "\nBasket Tokens",
      wrappedBalance.tokens,
      "\nBasket Tokens amounts",
      wrappedBalance.amounts.toString(),
    );

  });

  it("Wrapping only from allowed list", async function () {
    console.log("Starting wrap with not allowed token");
    const toSwap = ethers.utils.parseEther("20");

    const userTokenB = TokenB.connect(user2);
    const NotAllowedToken = NotListedToken.connect(user2);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await NotAllowedToken.approve(ErcWrapper.address, toSwap);

    const userWrapper = ErcWrapper.connect(user2);

    await expect(userWrapper.wrapper([NotAllowedToken.address, TokenB.address], [toSwap, toSwap])).to.be.revertedWith("No Chainlink Price Feed Available");
    const hasTokens = await userWrapper.balanceOf(user2.address);
    console.log("Wrap failed (should), balance of", user2.address, "is:", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);
  });

  it("Unwrapping", async function () {
    const NotAllowedUser = ErcWrapper.connect(user2);
    console.log("owner:", user1.address, "notAllowed:", user2.address);
    const showOwner = await ErcWrapper.balanceOf(user2.address);
    console.log("balance of notallowed:", showOwner.toString(), "(should be 0)");

    // WE KNOW USER2 DOESN'T OWN ANY BASKET AND CANNOT UNWRAP NOT OWNED BASKET
    await expect(NotAllowedUser.unwrapper(1)).to.be.revertedWith("Not an owner of a basket");
    console.log("Only owner can unwrap (revert)! good!");

    // SUCCEEDS AS SHOULD, USER1 UNWRAPS WRAP1 AND ZEROES BALANCE
    const userWrapper = ErcWrapper.connect(user1);
    const basketId = await userWrapper.ownerOf(1);
    console.log("owner of basketId 1", basketId.toString());
    await expect(userWrapper.unwrapper(1));
    const hasTokens = await userWrapper.balanceOf(user1.address);
    console.log("basket unwrapped! current balance of baskets =", hasTokens.toString());
    expect(hasTokens).to.be.equal(0);
    // show token balance of unwrap caller

  });

  it("Transfer from U1 to U2", async function () {
    const toSwap = ethers.utils.parseEther("20");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);

    // Create Basket for User1
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    // Transfer Basket from User1 to User2
    await userWrapper.approve(user2.address, 2);
    await userWrapper.transferFrom(user1.address, user2.address, 2);

    // Check User2 Balance
    const userWrapper2 = ErcWrapper.connect(user2);
    console.log("basket transfered from", user1.address, "to", user2.address);
    const basketPrice = await userWrapper2.balanceOf(user2.address);
    console.log(basketPrice.toString(), "baskets owned by", user2.address);
  });

  it("User1 tries to unwrap already sent Basket", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.unwrapper(1)).to.be.reverted;
    console.log("unwrapping already unwrapped token revert! good!");
  });

  it("User2 can unwrap after transfer", async function () {
    // Remember to fix tracking of tokenIds
    const userWrapper = ErcWrapper.connect(user2);
    await userWrapper.unwrapper(2);
    console.log("user2 unwraps basket after transfer! good!");
  });

  it("Show balances", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const b1 = await userWrapper.balanceOf(user1.address);
    const b2 = await userWrapper.balanceOf(user2.address);
    console.log("user1 balanceOf (baskets)", b1.toString(), "user2 balanceOf", b2.toString());
  });

  it("Mint 2 new baskets", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const toSwap = ethers.utils.parseEther("20");
    const userTokenA = TokenA.connect(user1);
    const userTokenB = TokenB.connect(user1);

    console.log("Minting 2 baskets to user1");
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);

    const b1 = await userWrapper.balanceOf(user1.address);
    const b2 = await userWrapper.balanceOf(user2.address);
    console.log("user1 balanceOf (baskets)", b1.toString(), "user2 balanceOf", b2.toString());
  });

  it("Create Order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const fixedPremium = ethers.utils.parseEther("0.05");
    await userWrapper.createOrder(3, fixedPremium);
    const basketPrice = await userWrapper.basketPrice(user1.address, 3);
    console.log("basket priced at", basketPrice.toString());

    console.log("creating another order to test cancel later");
    await userWrapper.createOrder(4, fixedPremium);
    const basketPrice2 = await userWrapper.basketPrice(user1.address, 4);
    console.log("basket priced at", basketPrice2.toString());
  });

  it("Negative cases for createOrder, owner operations", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const user2Wrapper = ErcWrapper.connect(user2);
    const fixedPremium = ethers.utils.parseEther("0.05");
    await expect(userWrapper.createOrder(3, fixedPremium)).to.be.revertedWith("Basket already listed");
    console.log("no doubling orders!")
    await expect(user2Wrapper.createOrder(3, fixedPremium)).to.be.revertedWith("Not an owner of a basket");
    console.log("only owner of basket can create order!")
  });

  it("Negative cases for createOrder, transfers locked", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.approve(user2.address, 3);
    await expect(userWrapper.transferFrom(user1.address, user2.address, 3)).to.be.revertedWith("Cannot transfer locked");
    console.log("user1 cannot transfer basket currently for sale");
  });

  it("Negative case for fillOrder, not enough funds", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    const value = await userWrapper.basketPrice(user1.address, 3);
    const wrongValue = ethers.utils.parseEther("0.0001");
    await expect(userWrapper.fillOrder(user1.address, 3, { value: wrongValue })).to.be.revertedWith("Not enough funds transfered");
    console.log("user2 doesnt send enough of the funds!");
  });

  it("Negative case for fillOrder, basket not for sale", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const toSwap = ethers.utils.parseEther("20");
    const value = await userWrapper.basketPrice(user1.address, 3);
    const userTokenA = TokenA.connect(user1);
    const userTokenB = TokenB.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    // Create another basket, but do not list it
    await userWrapper.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]); // 5
    await expect(userWrapper.fillOrder(user1.address, 5, { value })).to.be.revertedWith("Basket not locked for sale");
    console.log("user2 cannot buy what user1 didnt list!");
  });

  it("Fill Order", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    const value = await userWrapper.basketPrice(user1.address, 3);
    await userWrapper.fillOrder(user1.address, 3, { value });
    console.log("first order filled by user2")
  });

  it("Negative case for fillOrder, cannot fill already filled", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    const value = await userWrapper.basketPrice(user1.address, 3);
    await expect(userWrapper.fillOrder(user1.address, 3, { value })).to.be.revertedWith("Basket not locked for sale");
    console.log("first order filled by user2")
  });

  it("Negative case for cancelOrder, only owner can cancel", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    await expect(userWrapper.cancelOrder(4)).to.be.revertedWith("Not an owner of a basket");
    console.log("user2 fails to cancel order of user1!");
  });

  it("Negative case for cancelOrder, cannot cancel unlisted", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.cancelOrder(5)).to.be.revertedWith("Not for sale");
    console.log("user1 cannot cancel order which doesnt exist!");
  });

  it("Cancel Order", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.cancelOrder(4);
    console.log("order canceled by user1");
  });

  it("Update price", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const fixedPremium = ethers.utils.parseEther("0.0661");
    const newPremium = ethers.utils.parseEther("0.0991");
    await expect(userWrapper.createOrder(5, fixedPremium));
    const firstPrice = await userWrapper.basketPrice(user1.address, 5);
    console.log("setting first price to", firstPrice.toString());
    await userWrapper.updatePrice(5, newPremium);
    const newPrice = await userWrapper.basketPrice(user1.address, 5);
    console.log("price updated, new price", newPrice.toString());
  });

});

describe("HTLC Basket Swap", () => {
  let ErcWrapper: Contract;
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let TokenD: Contract;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let u1contractId: Bytes;
  let u2contractId: Bytes;
  let secret: string;
  let hash: string;
  let learnedSecret: Bytes;
  
  before(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    // Mint two tokens and send to user1 & user2
    const ERC20Factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, deployer);
    TokenA = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenB = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenC = await ERC20Factory.deploy(TOTALSUPPLY);
    TokenD = await ERC20Factory.deploy(TOTALSUPPLY);

    // User1 Tokens
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));

    // User2 Transfer
    await TokenC.transfer(user2.address, ethers.utils.parseEther("100"));
    await TokenD.transfer(user2.address, ethers.utils.parseEther("100"));

    // Deploy ERCWrapper
    const feeds = await fs.readFileSync("scripts/feeds.txt", "utf-8").split('\n');
    const wrapperFactory = new ErcWrapper__factory(deployer);
    ErcWrapper = await wrapperFactory.deploy([TokenA.address, TokenB.address, TokenC.address, TokenD.address], feeds);

    // Deploy HTLC
    // const HTLCFactory = new HashedTimelockERC721__factory(deployer);
    // HTLC = await HTLCFactory.deploy();

    const bufToStr = (b: any) => '0x' + b.toString('hex')
    const sha256 = (x: any) =>
      crypto
        .createHash('sha256')
        .update(x)
        .digest()

    const random32 = () => crypto.randomBytes(32)
    const isSha256Hash = (hashStr: any) => /^0x[0-9a-f]{64}$/i.test(hashStr)
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

  });


  it("Create Basket for U1 and U2 to exchange later", async function () {
    const toSwap = ethers.utils.parseEther("20");
    const toSwap2 = ethers.utils.parseEther("11");

    // Approve two tokens which will become NFT-Index
    const userTokenA = TokenA.connect(user1);
    const userTokenB = TokenB.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    await userTokenB.approve(ErcWrapper.address, toSwap);

    const userTokenA2 = TokenC.connect(user2);
    const userTokenB2 = TokenD.connect(user2);
    await userTokenA2.approve(ErcWrapper.address, toSwap);
    await userTokenB2.approve(ErcWrapper.address, toSwap);

    // U1
    const userWrapper1 = ErcWrapper.connect(user1);
    await userWrapper1.wrapper([TokenA.address, TokenB.address], [toSwap, toSwap]);
    console.log("created wrap for user1!");
    const u1balance = await userWrapper1.wrappedBalance(1);
    console.log("u1 basket balance before swapping");
    console.log(
      "Basket ID",
      u1balance.id.toString(),
      "\nBasket Tokens",
      u1balance.tokens,
      "\nBasket Tokens amounts",
      u1balance.amounts.toString(),
    );

    // U2
    const userWrapper2 = ErcWrapper.connect(user2);
    await userWrapper2.wrapper([TokenC.address, TokenD.address], [toSwap2, toSwap2]);
    console.log("created wrap for user2!");
    const u2balance = await userWrapper2.wrappedBalance(2);
    console.log("u2 basket balance before swapping");
    console.log(
      "Basket ID",
      u2balance.id.toString(),
      "\nBasket Tokens",
      u2balance.tokens,
      "\nBasket Tokens amounts",
      u2balance.amounts.toString(),
    );

  });

  it("U1 sets up swap with Basket1", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    // const userHTLC = HTLC.connect(user1);

    const timeLock2Sec = Date.now() + 2000;
    const balanceBefore = await userWrapper.balanceOf(user1.address);
    console.log("how many baskets user1 owns before", balanceBefore.toString());
    console.log("ercwrapper (inlcuding htlc) address:");
    console.log(ErcWrapper.address);
    await userWrapper.approve(ErcWrapper.address, 1) // approve HTLC for token 1;
    console.log("approved htlc contract!");
    // receiver, _hashlock, _timelock, _tokenContract, _tokenId
    const tx = await userWrapper.newContract(user2.address, hash, timeLock2Sec, userWrapper.address, 1);
    const balanceAfter = await userWrapper.balanceOf(user1.address);
    console.log("how many baskets user1 owns after", balanceAfter.toString());
    let receipt = await tx.wait();
    let details = receipt.events?.filter((x: any) => { return x.event == "HTLCERC721New" });
    let contractId = details[0].args.contractId;
    console.log("contract id", contractId);
    u1contractId = contractId;
  });

  it("U2 setus up swap with Basket2", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    // const userHTLC = HTLC.connect(user2);

    const timeLock2Sec = Date.now() + 2000;
    const balanceBefore = await userWrapper.balanceOf(user2.address);
    console.log("how many baskets user2 owns before", balanceBefore.toString());
    await userWrapper.approve(ErcWrapper.address, 2) // approve HTLC for token 2;
    console.log("approved htlc contract!");
    // receiver, _hashlock, _timelock, _tokenContract, _tokenId
    const tx = await userWrapper.newContract(user1.address, hash, timeLock2Sec, userWrapper.address, 2);
    const balanceAfter = await userWrapper.balanceOf(user2.address);
    console.log("how many baskets user2 owns after", balanceAfter.toString());
    let receipt = await tx.wait();
    let details = receipt.events?.filter((x: any) => { return x.event == "HTLCERC721New" });
    let contractId = details[0].args.contractId;
    console.log("contract id", contractId);
    u2contractId = contractId;
  });

  it("Check HTLC balance before users swap", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const ownedTokenId1 = await userWrapper.ownerOf(1);
    const ownedTokenId2 = await userWrapper.ownerOf(2);
    console.log("owner of basket1", ownedTokenId1);
    console.log("owner of basket2", ownedTokenId2);
    console.log("should be same");
    const u1balance = await userWrapper.wrappedBalance(1);
    console.log("htlc basket1 balance before swapping");
    console.log(
      "Basket ID",
      u1balance.id.toString(),
      "\nBasket Tokens",
      u1balance.tokens,
      "\nBasket Tokens amounts",
      u1balance.amounts.toString(),
    );

  });

  it("U1 tries to transfer basket locked in swap", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    await expect(userWrapper.approve(user2.address, 1)).to.be.reverted;
    console.log("approve fails because basket is already owned by htlc")
  });

  it("U1 tries to create an order when basket locked in swap", async function() {
    const userWrapper = ErcWrapper.connect(user1);
    const fixedPremium = ethers.utils.parseEther("0.05");
    await expect(userWrapper.createOrder(1, fixedPremium)).to.be.reverted;
    console.log("createOrder fails because basket is already owned by htlc")
  });

  it("U1 withdraws", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    // const userHTLC = HTLC.connect(user1);
    await userWrapper.withdraw(u2contractId, secret);
    const balanceAfter = await userWrapper.balanceOf(user1.address);
    console.log("withdraw of u2 token to u1, current u1 balance:", balanceAfter.toString());
  });

  it("U2 withdraws with secret", async function () {
    const userWrapper = ErcWrapper.connect(user2);
    // const userHTLC = HTLC.connect(user2);
    const contractArr = await userWrapper.getContract(u2contractId);
    learnedSecret = contractArr[8];
    console.log("secret", learnedSecret);
    await userWrapper.withdraw(u1contractId, learnedSecret);
    const balanceAfter = await userWrapper.balanceOf(user2.address);
    console.log("withdraw of u1 token to u2, current u2 balance:", balanceAfter.toString());
  });

  it("Check balances", async function () {
    const userWrapper = ErcWrapper.connect(user1);
    const ownedTokenId1 = await userWrapper.ownerOf(1);
    const ownedTokenId2 = await userWrapper.ownerOf(2);
    await expect(ownedTokenId1).to.be.equal(user2.address);
    await expect(ownedTokenId2).to.be.equal(user1.address);
    console.log('users balances after swap match!');
  });

  it("Check Basket ownership after swap", async function () {
    const userWrapper1 = ErcWrapper.connect(user1);
    // Because U1 now owns tokenId 2
    const u1balance = await userWrapper1.wrappedBalance(2);
    console.log("u1 basket balance after swapping");
    console.log(
      "Basket ID",
      u1balance.id.toString(),
      "\nBasket Tokens",
      u1balance.tokens,
      "\nBasket Tokens amounts",
      u1balance.amounts.toString(),
    );

    // Because U2 now owns tokenId 1
    const userWrapper2 = ErcWrapper.connect(user2);
    const u2balance = await userWrapper2.wrappedBalance(1);
    console.log("u2 basket balance after swapping");
    console.log(
      "Basket ID",
      u2balance.id.toString(),
      "\nBasket Tokens",
      u2balance.tokens,
      "\nBasket Tokens amounts",
      u2balance.amounts.toString(),
    );

  });

});