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
Feature: P2P exchange of Baskets / Buy-Sell Basket for ETH
Extended feature: Stack NFT Basket for overcollaterized loan
Chainlink role: Current value of the Basket
ERC721 URI: Additional data which makes sense to calculate offchain (e.g volatility)

Contract should be fully ERC721 capable.

1) Users approves and sends tokens
2) Contract checks if tokens are whitelisted for wrapping
    2a) Function wrappedBackend is a placeholder for change of dev path and doing whitelisting offchain, considerations are above function definition
3) User wrappedBalance incremented, NFT token coresponding to balance minted (mapping wrapped)
4) User can unwrap NFT he owns back to his ERC20 tokens.
5) User can transfer (trade*) NFT and ownership of claim on wrapped Tokens
6) User can check balance of his basket
7) Contract uses chainlink Ethereum Price Feeds to calculate value of the Basket (explains also limits on tokens in Basket)

Current thoughts:
1) Appropriate types for storage variables (price feeds & user balance)
2) Access control to functions (currently require, limited modifiers)
3) Loops avoidance
4) Better construction of Whitelist (superlong contructor is bad)
 */

contract ercWrapper is ERC721, Whitelist {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _wrapID;
    AggregatorV3Interface internal priceFeed;

    address private backend;
    mapping(address => mapping(uint256 => UserIndex)) private wrapped;
    mapping(address => mapping(uint256 => uint256)) private pricing;

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
        bool locked;
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

        // This is for sure not optimal solution
        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = isAllowed(tokens[i]);
            require(success == true, "No Chainlink Price Feed Available");
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
        
        // This needs to be a Struct too because bidders will need to have an access in placeOrder
        // Add deadline, Slippage (hm, BUYER vs. SELLER slippage)
        pricing[msg.sender][_wrapId] = priceBasket(_wrapId); // Set price for basket ***SHOULD BE GENERALLY FUNCTION CALLED MULTIPLE TIMES THROUGH CONTRACT***
        // Here Exchange logic should start :) Lets assume that this contract executes following good access patern (before testing)
    }

    function fillOrder(address payable _owner, uint256 _wrapId) public payable {
        require(wrapped[_owner][_wrapId].locked = true, "Basket not locked for sale");
        // Buyer needs to know the price. Seller needs to set the price.
        require(pricing[_owner][_wrapId] >= msg.value, "Not enough funds transfered");

        // NOTE: An ultimate problem is that there is no way for ensuring correct on-chain pricing <> delivery
        // Assumption 1: Can pricing be 0 cost? Solution: Centrlize (parts of ) contract and ensure correct price
        // Assumption 2: Can data update happen on low costs and with right incentive?
        // EXAMPLE: Who should pay for price-check? How does one bid? How does one stake?
        // PRICING IS THE PROBLEM SO EVEN METATX DOESN'T SOLVE IT...
        
        _owner.transfer(msg.value);
        wrapped[_owner][_wrapId].locked = false;
        super._transfer(_owner, msg.sender, _wrapId); // Call ERC721
        wrapped[msg.sender][_wrapId] = wrapped[_owner][_wrapId];
        delete wrapped[_owner][_wrapId];
    }


    function priceBasket(uint256 _wrapId) public returns (uint256 basketPrice) {
        // NOTE: Currently it returns only total price of Basket. Should also give access to individual components.
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        uint256 total;
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            address feed = getMember(wrapped[msg.sender][_wrapId].tokens[i]);
            priceFeed = AggregatorV3Interface(feed); // feed is correct, checked with getMember
            
            // NOTE: THIS IS MOCKUP OF LINK FUNCTION TO KEEP MAINNET WHITELIST
            // Should be tested with kovan anyways!
            // (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) =
            //         priceFeed.latestRoundData();

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
        return (pricing[owner][_wrapId]);
    }
}
