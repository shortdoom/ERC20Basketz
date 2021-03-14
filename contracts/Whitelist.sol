pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

contract Whitelist {

    mapping(address => address) private priceList; // This def stays, because we need to match neatly token<>pair

    // address aaveFeed = LINK price feed
    // priceList[_aave] = aaveFeed / Return price feed for user token
    constructor(
        address _aave,
        address _btcFeed
    ) {
        // TokenA is allowed because it's in priceList
        address aaveFeed = 0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012;
        priceList[_aave] = aaveFeed;

        address btcFeed = 0xdeb288F737066589598e9214E782fa5A8eD689e8;
        priceList[_btcFeed] = btcFeed;
    }

    function isAllowed(address token) public view returns (bool) {
        // require(priceList[token]);
        return(true);
    }
    function getMember(address token) public view returns (address) {
        return (priceList[token]);
    }

}