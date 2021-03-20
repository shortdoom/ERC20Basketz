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
Feature: P2P exchange of Baskets / Buy-Sell Basket for ETH / Swap Basket<>Basket
Extended feature: Bidding on Baskets
Extended feature: Use Basket for a loan on a 3rd party service. Staking function.
Chainlink role: Current value of the Basket.
ERC721 URI: Additional data which makes sense to calculate offchain (e.g volatility, performance of basket over time)

Contract should be fully ERC721 capable.

1) Users approves and sends tokens (min. 2, max. 10)
2) Contract checks if tokens are whitelisted for wrapping
    2a) Function wrappedBackend is a placeholder for a possible change of development path and doing whitelisting offchain
3) User wrappedBalance incremented, NFT token coresponding to balance minted (mapping `wrapped`)
4) User can unwrap NFT he owns back to his ERC20 tokens.
5) User can transfer (trade*) NFT and ownership of claim on wrapped Tokens
6) User can check balance of his basket
7) Contract uses chainlink Ethereum Price Feeds to calculate value of the Basket (explains also limits on tokens in Basket)

Current thoughts:

Reversed Auto Matching
Buyers pool funds and specify bid vectors (Can they update vectors?)

1) Appropriate types for storage variables (price feeds & user balance)
2) Access control to functions (currently require, limited modifiers)
3) Loops avoidance
4) Contract structure is chaotic (Factory pattern?)
5) Gas optimization
 */

contract ercWrapper is ERC721, Whitelist {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _wrapID;
    AggregatorV3Interface internal priceFeed;

    address private backend;
    mapping(address => mapping(uint256 => UserIndex)) public wrapped;
    mapping(address => mapping(uint256 => Bid)) public bidding;

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
        bool locked;
    }

    struct Bid {
        uint256 deadline;
        uint256 priceSlip; // Allowed slip from price after posting order
        uint256 price; // 
    }

    modifier backEnd() {
        require(msg.sender == backend, "Pre-checked whitelist tokens");
        _;
    }

    constructor(address[] memory _tokens, address[] memory _feeds) ERC721("WrappedIndex", "WRAP") Whitelist(_tokens, _feeds) {
        backend = msg.sender;
    }

    // :::::NOTE:::::
    // Onchain (can be expensive, at least one loop)
    // Off-chain (no longer permissionless, easier, cheaper)
    // An ideal would be to allow ALL ERC20 and let market price it
    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {
        uint256 basketSize = tokens.length;
        require(basketSize <= 10, "Maxiumum  Basket size allowed");

        // This is for sure not an optimal solution
        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = isAllowed(tokens[i]);
            // bool s1 = Whitelist.priceList[tokens[i]];
            require(success, "No Chainlink Price Feed Available");
        }

        for (uint256 i = 0; i < tokens.length; i++) {
            // NOTE: Refund if some token transfer failed
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success, "Transfer failed");
        }

        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({ tokens: tokens, amounts: amounts, locked: false });
        _mint(msg.sender, wrapId);
        // NOTE: URI. Maybe off-chain stats, lightweight analysis of basket price change, volatility grade, dashboard for portfolio etc.

        return wrapId;
    }

    function wrapperBackend(address[] memory tokens, uint256[] memory amounts) public backEnd returns (uint256) {
        // NOTE: No need to check, but introduces additional role of backEnd script
        uint256 basketSize = tokens.length;
        require(basketSize <= 10, "Maxiumum  Basket size allowed");
        for (uint256 i = 0; i < tokens.length; i++) {
            // NOTE: Refund if some token transfer failed
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success, "Transfer failed");
        }
        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({ tokens: tokens, amounts: amounts, locked: false });
        _mint(msg.sender, wrapId);
        return wrapId;
    }

    function unwrapper(uint256 _wrapId) public {
        // require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        address owner = ERC721.ownerOf(_wrapId); // Fails here? Check addresses
        require(msg.sender == owner, "Not an owner of a basket");
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

    function createOrder(uint256 _wrapId, uint256 _deadline, uint256 _priceSlip, uint256 _premium) external {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        wrapped[msg.sender][_wrapId].locked = true; // Cannot transfer & Unwrap now
        // pricing[msg.sender][_wrapId] = priceBasket(_wrapId); // Sets Initial Price
        uint256 priceFloor = priceBasket(_wrapId);
        uint256 premium = _premium;
        bidding[msg.sender][_wrapId] = Bid({deadline: _deadline, priceSlip: _priceSlip, price: priceFloor});
    }

    function fillOrder(address payable _owner, uint256 _wrapId) public payable {
        require(wrapped[_owner][_wrapId].locked = true, "Basket not locked for sale");
        require(bidding[_owner][_wrapId].price >= msg.value, "Not enough funds transfered");
        require(bidding[_owner][_wrapId].deadline >= block.timestamp, "Pass deadline"); 
        // require(bidding[_owner].priceSlip >= msg.value, "Pricing out of bounds"); // This should check function returning correct calculation        
        
        _owner.transfer(msg.value);
        wrapped[_owner][_wrapId].locked = false;
        super._transfer(_owner, msg.sender, _wrapId); // Call ERC721
        wrapped[msg.sender][_wrapId] = wrapped[_owner][_wrapId];
        delete wrapped[_owner][_wrapId];
    }

    function cancelOrder(uint256 _wrapId) public {
        address owner = ERC721.ownerOf(_wrapId);
        require(owner == msg.sender, "Not an owner of a basket");
        delete bidding[msg.sender][_wrapId];
        wrapped[msg.sender][_wrapId].locked = false;
    }


    function priceBasket(uint256 _wrapId) public returns (uint256 basketPrice) {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        uint256 total;
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            address feed = getMember(wrapped[msg.sender][_wrapId].tokens[i]);
            priceFeed = AggregatorV3Interface(feed); // feed is correct, checked with getMember
            int256 price = MockLinkFeed();
            total = total.add(uint256(price));
        }
        return total;
    }

    function MockLinkFeed() public pure returns(int256) {
        // Could get real price from mainnet  
        int256 value = 66666;
        return(value);
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

    function basketBalance(address owner, uint256 _wrapId) public view returns (uint256) {
        return (bidding[owner][_wrapId].price);
    }
}
