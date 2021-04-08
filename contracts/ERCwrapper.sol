pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./Whitelist.sol";
import "./ControlHTLC.sol";

/**

Basic functionality: Wrap & Unwrap ERC20 Baskets stored as NFT
Extended basic functionality: Ability to Transfer ERC20 Baskets as NFT
Feature: P2P exchange of Baskets / Buy-Sell Basket for ETH / Swap Basket<>Basket
Extended feature: Auctioning baskets
Extended feature: Use Basket for a loan on a 3rd party service. Staking function.
Chainlink role: Current value of the Basket.
ERC721 URI: Additional data which makes sense to calculate offchain (e.g volatility, performance of basket over time)
 */

contract ercWrapper is ERC721, Whitelist, ControlHTLC {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _wrapID;
    AggregatorV3Interface internal priceFeed;

    // Event for wrapper
    event BasketCreated(address owner, uint256 wrapId, address[] tokens, uint256[] amounts);

    // Event for unwrapper
    event BasketUnwraped(address owner, uint256 wrapId);

    // Event for createOrder
    event OrderCreated(address owner, uint256 wrapId, uint256 price, uint256 premium);

    // Event for priceBasket
    event BasketPrice(uint256 _wrapId, uint256 total);

    // Event for fillOrder
    event OrderFilled(address owner, address newOwner, uint256 wrapId);

    // Event for cancelOrder
    event OrderCancelled(address owner, uint256 wrapId);

    mapping(address => mapping(uint256 => UserIndex)) public wrapped;
    mapping(address => mapping(uint256 => Bid)) public bidding;

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
        bool locked;
    }

    struct Bid {
        uint256 price;
        bool onSale;
    }

    constructor(address[] memory _tokens, address[] memory _feeds)
        ERC721("Basketz", "BWRAP")
        Whitelist(_tokens, _feeds)
    {}

    receive() external payable {}

    fallback() external payable {}

    // :::::NOTE:::::
    // Onchain (can be expensive, at least one loop)
    // Off-chain (no longer permissionless, easier, cheaper)
    // An ideal would be to allow ALL ERC20 and let market price it, but that's not happening :)

    /** Wrapping and unwrapping of ERC20<=>ERC721 */
    function wrapper(address[] memory tokens, uint256[] memory amounts) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            bool allowedToken = isAllowed(tokens[i]);
            require(allowedToken, "No Chainlink Price Feed Available");
            bool transferSuccess = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(transferSuccess, "Transfer failed");
        }

        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({ tokens: tokens, amounts: amounts, locked: false });
        _mint(msg.sender, wrapId);
        // NOTE: URI. Off-chain stats, lightweight analysis of basket price change, volatility grade, dashboard for portfolio etc.

        emit BasketCreated(msg.sender, wrapId, tokens, amounts);
    }

    function unwrapper(uint256 _wrapId) public {
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
        emit BasketUnwraped(msg.sender, _wrapId);
    }

    function _transfer(
        address from,
        address to,
        uint256 _wrapId
    ) internal override {
        require(wrapped[from][_wrapId].locked == false, "Cannot transfer locked");
        wrapped[to][_wrapId] = wrapped[from][_wrapId];
        super._transfer(from, to, _wrapId);
        delete wrapped[from][_wrapId];
    }

    /** Swaping with HTLC */
    function newContract(
        address _receiver,
        bytes32 _hashlock,
        uint256 _timelock,
        address _tokenContract,
        uint256 _tokenId
    ) external tokensTransferable(_tokenContract, _tokenId) futureTimelock(_timelock) returns (bytes32 contractId) {
        contractId = sha256(abi.encodePacked(msg.sender, _receiver, _tokenContract, _tokenId, _hashlock, _timelock));

        if (super.haveContract(contractId)) revert("Contract already exists");
        ERC721(_tokenContract).transferFrom(msg.sender, address(this), _tokenId);

        contracts[contractId] = LockContract(
            msg.sender,
            _receiver,
            _tokenContract,
            _tokenId,
            _hashlock,
            _timelock,
            false,
            false,
            0x0
        );

        emit HTLCERC721New(contractId, msg.sender, _receiver, _tokenContract, _tokenId, _hashlock, _timelock);
    }

    function withdraw(bytes32 _contractId, bytes32 _preimage)
        external
        contractExists(_contractId)
        hashlockMatches(_contractId, _preimage)
        withdrawable(_contractId)
        returns (bool)
    {
        LockContract storage c = contracts[_contractId];
        c.preimage = _preimage;
        c.withdrawn = true;
        ERC721(c.tokenContract).transferFrom(address(this), c.receiver, c.tokenId);
        emit HTLCERC721Withdraw(_contractId);
        return true;
    }

    function refund(bytes32 _contractId) external contractExists(_contractId) refundable(_contractId) returns (bool) {
        LockContract storage c = contracts[_contractId];
        c.refunded = true;
        ERC721(c.tokenContract).transferFrom(address(this), c.sender, c.tokenId);
        emit HTLCERC721Refund(_contractId);
        return true;
    }

    /** Bidding mechanism. Temporarily fully on-chain.
        This may or may not have a sense. Limited liquidity,
        price update lag, price update costs. The only mitigation
        currently is setting of _premium over basket price.
     */

    function createOrder(uint256 _wrapId, uint256 _premium) external {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        require(bidding[msg.sender][_wrapId].onSale == false, "Basket already listed");
        wrapped[msg.sender][_wrapId].locked = true; // Cannot transfer & Unwrap now
        // NOTE: priceBasket functions on-chain is expensive, chainlink price feed can be used off-chain
        uint256 _priceBasket = priceBasket(_wrapId);
        uint256 price = _priceBasket.add(_premium);
        bidding[msg.sender][_wrapId] = Bid({ price: price, onSale: true });
        emit OrderCreated(msg.sender, _wrapId, price, _premium);
    }

    function fillOrder(address payable _owner, uint256 _wrapId) public payable {
        require(wrapped[_owner][_wrapId].locked == true, "Basket not locked for sale");
        require(msg.value >= bidding[_owner][_wrapId].price, "Not enough funds transfered");

        _owner.transfer(msg.value);
        wrapped[_owner][_wrapId].locked = false;
        super._transfer(_owner, msg.sender, _wrapId);
        wrapped[msg.sender][_wrapId] = wrapped[_owner][_wrapId];
        delete wrapped[_owner][_wrapId];
        emit OrderFilled(_owner, msg.sender, _wrapId);
    }

    function cancelOrder(uint256 _wrapId) public {
        address owner = ERC721.ownerOf(_wrapId);
        require(owner == msg.sender, "Not an owner of a basket");
        require(wrapped[msg.sender][_wrapId].locked == true, "Not for sale");
        delete bidding[msg.sender][_wrapId];
        wrapped[msg.sender][_wrapId].locked = false;
        emit OrderCancelled(msg.sender, _wrapId);
    }

    function priceBasket(uint256 _wrapId) public returns (uint256) {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        uint256 total;
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            address feed = getMember(wrapped[msg.sender][_wrapId].tokens[i]);
            priceFeed = AggregatorV3Interface(feed);
            // NOTE: This means chainlink gets price on-chain, should be moved off chain
            // NOTE: This also makes BasicTests fail because you can get price only from rinkeby and not local hardhat
            (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) =
                priceFeed.latestRoundData();
            total = total.add(uint256(price));
        }
        emit BasketPrice(_wrapId, total);
        return total;
    }

    function updatePrice(uint256 _wrapId, uint256 _premium) public returns (uint256) {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        require(bidding[msg.sender][_wrapId].onSale == true, "Basket not listed");
        uint256 _priceBasket = priceBasket(_wrapId);
        uint256 price = _priceBasket.add(_premium);
        bidding[msg.sender][_wrapId].price = price;
        return price;
    }

    /** View functions for wrap and bidding */

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

    function basketPrice(address owner, uint256 _wrapId) public view returns (uint256) {
        return (bidding[owner][_wrapId].price);
    }
}
