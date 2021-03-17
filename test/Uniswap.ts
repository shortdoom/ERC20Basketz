import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ErcWrapper__factory } from "../typechain";

import ERC20 from "@uniswap/v2-periphery/build/ERC20.json";
import UniswapV2Router02 from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { ChainId, Token, WETH, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk'


chai.use(solidity);
const { expect } = chai;

const TOTALSUPPLY = ethers.utils.parseEther("10000");

describe("Testing ERCwrapper with Uniswap Tokens", () => {
  let ErcWrapper: Contract;
  let TokenA: Contract;
  let TokenB: Contract;
  let TokenC: Contract;
  let NotListedToken: Contract;
  let SnxContract: Contract;
  let UniContract: Contract;
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
    await TokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenB.transfer(user1.address, ethers.utils.parseEther("100"));
    await TokenC.transfer(user1.address, ethers.utils.parseEther("100"));
    await NotListedToken.transfer(user1.address, ethers.utils.parseEther("100"));

    // Load user1 & user2 with AAVE and SNX from Uniswap
    const UniAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const SnxToken = "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f";
    const UniToken = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    SnxContract = new ethers.Contract(SnxToken, ERC20.abi, user1);
    UniContract = new ethers.Contract(UniToken, ERC20.abi, user2);

    const wrapperFactory = new ErcWrapper__factory(deployer);
    ErcWrapper = await wrapperFactory.deploy(SnxContract.address, UniContract.address);

    const user1Router = new ethers.Contract(UniAddress, UniswapV2Router02.abi, user1);
    const user2Router = new ethers.Contract(UniAddress, UniswapV2Router02.abi, user1);

    let deadline = Date.now() + 300;
    const valueBigNum = ethers.utils.parseEther("10");
    const value = ethers.BigNumber.from(valueBigNum.toString()).toHexString();

    const SNX = new Token(ChainId.MAINNET, SnxToken, 18);
    const pair = await Fetcher.fetchPairData(SNX, WETH[SNX.chainId])
    const route = new Route([pair], WETH[SNX.chainId])
    const amountIn = '1000000000000000000' // 1 WETH
    const trade = new Trade(route, new TokenAmount(WETH[SNX.chainId], amountIn), TradeType.EXACT_INPUT)

    const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
    const amountOutMin = ethers.BigNumber.from(trade.minimumAmountOut(slippageTolerance).raw.toString()).toHexString();
    const path = [WETH[SNX.chainId].address, SNX.address]

    const UNI = new Token(ChainId.MAINNET, UniToken, 18);
    const pairUni = await Fetcher.fetchPairData(UNI, WETH[UNI.chainId])
    const routeUni = new Route([pairUni], WETH[UNI.chainId])
    const amountInUni = '1000000000000000000' // 1 WETH -- should be value otherwise it's ignored anyways
    const tradeUni = new Trade(routeUni, new TokenAmount(WETH[UNI.chainId], amountInUni), TradeType.EXACT_INPUT)
    const amountOutMinUni = ethers.BigNumber.from(tradeUni.minimumAmountOut(slippageTolerance).raw.toString()).toHexString();
    const pathUni = [WETH[UNI.chainId].address, UNI.address]

    // Buy SNX & UNI for user1
    await user1Router.swapExactETHForTokens(amountOutMin, path, user1.address, deadline, {value});
    await user1Router.swapExactETHForTokens(amountOutMinUni, pathUni, user1.address, deadline, {value});
    const balanceSnx = await SnxContract.balanceOf(user1.address);
    console.log("SNX purchased", ethers.utils.formatUnits(balanceSnx.toString(), "ether"));

    await user2Router.swapExactETHForTokens(amountOutMin, path, user2.address, deadline, {value});
    await user2Router.swapExactETHForTokens(amountOutMinUni, pathUni, user2.address, deadline, {value});
    const balanceUni = await UniContract.balanceOf(user2.address);
    console.log("UNI purchased", ethers.utils.formatUnits(balanceUni.toString(), "ether"));

  });

  it("Price Basket", async function () {
    const toSwap = ethers.utils.parseEther("0.1");

    // Approve two tokens which will become NFT-Index
    const userTokenA = SnxContract.connect(user1);
    await userTokenA.approve(ErcWrapper.address, toSwap);
    const userTokenB = UniContract.connect(user1);
    await userTokenB.approve(ErcWrapper.address, toSwap);
    
    const balanceSnx = await SnxContract.balanceOf(user1.address);
    console.log("SNX purchased", ethers.utils.formatUnits(balanceSnx.toString(), "ether"));
    const balanceUni = await UniContract.balanceOf(user1.address);
    console.log("UNI purchased", ethers.utils.formatUnits(balanceUni.toString(), "ether"));

    // const userWrapper = ErcWrapper.connect(user1);
    // const token = await userWrapper.getMember(SnxContract.address);
    // console.log(token);

    const userWrapper = ErcWrapper.connect(user1);
    await userWrapper.wrapper([SnxContract.address, UniContract.address], [toSwap, toSwap]);
    console.log('Successful wrapp with allowed');

    const wrappedBalance = await userWrapper.wrappedBalance(1);

    console.log(
      "Basket ID",
      wrappedBalance.id.toString(),
      "\nBasket Tokens",
      wrappedBalance.tokens,
      "\nBasket Tokens amounts",
      wrappedBalance.amounts.toString(),
    );

    // This will fail now
    // We need to mimic tokens existing in chainlink feeds (all mainnet)
    await userWrapper.createOrder(1);
    const value = await userWrapper.basketBalance(user1.address, 1);
    console.log("Curent basket Price:", value.toString());
  });

});

