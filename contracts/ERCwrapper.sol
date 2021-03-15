pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./Whitelist.sol";

/**
Basic functionality: Wrap & Unwrap ERC20 Baskets stored as NFT
Extended basic functionality: Ability to Transfer ERC20 Baskets as NFT
Feature: Sell Basket for ETH
Extended feature: Stack NFT Basket for overcollaterized loan

Chainlink role: Current value of the Basket
 */

contract ercWrapper is ERC721, Whitelist {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _wrapID;
    AggregatorV3Interface internal priceFeed;

    address private backend;
    mapping(address => mapping(uint256 => UserIndex)) private wrapped;
    mapping(address => mapping(uint256 => uint256)) private offer;

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
        bool locked;
    }

    modifier backEnd() {
        require(msg.sender == backend, "Pre-checked whitelist tokens");
        _;
    }

    constructor(address _aave, address _btcFeed) 
        ERC721("WrappedIndex", "WRAP")
        Whitelist(_aave, _btcFeed) {
            backend = msg.sender;
        }

    // Onchain (can be expensive, at least one loop)
    // Off-chain (no longer permissionless, easier, cheaper)
    // A perfect solution would be to allow ALL ERC20 and let market price it
    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {
        uint256 basketSize = tokens.length;
        require(basketSize <= 10, "Maxiumum  Basket size allowed");

        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = isAllowedLoop(tokens[i]);
            require(success == true, "No Chainlink Price Feed Available");
        }

        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success, "Transfer failed");   
  
        }
        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({ tokens: tokens, amounts: amounts, locked: false });
        _mint(msg.sender, wrapId);
        // NOTE: URI. Maybe off-chain stats, lightweight analysis of basket price change etc.

        return wrapId;
    }

    function wrapperBackend(address[] memory tokens, uint256[] memory amounts) public backEnd returns (uint256) {
        // No need to check, but introduces additional role of backEnd script
        for (uint256 i = 0; i < tokens.length; i++) {
                bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
                require(success, "Transfer failed");   
        }
        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({ tokens: tokens, amounts: amounts, locked: false });
        _mint(msg.sender, wrapId);
        return wrapId;
    }

    function unwrapper(uint256 _wrapId) external {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        require(wrapped[msg.sender][_wrapId].locked == false, "Cannot unwrap locked");
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            IERC20(wrapped[msg.sender][_wrapId].tokens[i]).approve(
                address(this),
                wrapped[msg.sender][_wrapId].amounts[i]
            );
            bool success =
                IERC20(wrapped[msg.sender][_wrapId].tokens[i]).transferFrom(
                    address(this),
                    msg.sender,
                    wrapped[msg.sender][_wrapId].amounts[i]
                );
            require(success);
        }

        delete wrapped[msg.sender][_wrapId];
        _burn(_wrapId);
    }

    function _transfer(
        address from,
        address to,
        uint256 _wrapId
    ) internal override {
        require(wrapped[msg.sender][_wrapId].locked == false, "Cannot transfer locked");
        super._transfer(from, to, _wrapId);

        // NOTE: Change Basket ownership with NFT transfer (token claim/unwrap)
        wrapped[to][_wrapId] = wrapped[msg.sender][_wrapId];
        delete wrapped[msg.sender][_wrapId];
    }

    function createOrder(uint256 _wrapId) external {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        wrapped[msg.sender][_wrapId].locked = true; // Cannot transfer & Unwrap now
        offer[msg.sender][_wrapId] = priceBasket(_wrapId); // Set price for basket
    }

    function priceBasket(uint256 _wrapId) public returns (uint256 basketPrice) {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        uint256 total;
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            priceFeed = AggregatorV3Interface(getMember(wrapped[msg.sender][_wrapId].tokens[i]));
            total.add(uint256(getLatestPrice()));
        }
        return total;
    }

    function getLatestPrice() public view returns (int256) {
        (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) =
            priceFeed.latestRoundData();
        return price;
    }

    function wrappedBalance(uint256 _wrapId)
        public
        view
        returns (
            uint256 id,
            address[] memory tokens,
            uint256[] memory amounts
        )
    {
        address owner = ERC721.ownerOf(_wrapId);
        return (_wrapId, wrapped[owner][_wrapId].tokens, wrapped[owner][_wrapId].amounts);
    }
}
