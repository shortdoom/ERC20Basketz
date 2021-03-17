pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

    /**
    Whitelist should be initialized at deployment.
    Constructor creates a list of available price feeds for chainlink.
    This contract is only called in relation to chainlink feed.
    https://docs.chain.link/docs/ethereum-addresses
     */

contract Whitelist {

    mapping(address => address) private priceList;

    constructor(
        address[] memory _tokens,
        address[] memory _feeds
    ) {
        // TokenA is allowed because it's in priceList
        // address snxFeed = 0xF9A76ae7a1075Fe7d646b06fF05Bd48b9FA5582e;
        // priceList[_snx] = snxFeed;

        // address uniFeed = 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e;
        // priceList[_uni] = uniFeed;

        for (uint256 i = 0; i > _feeds.length; i++) {
            priceList[_tokens[i]] = _feeds[i];
        }
    }

    function isAllowed(address token) public view returns (bool) {
        bool success = priceList[token] != address(0);
        return(success);
    }


    function getMember(address token) public view returns (address) {
        return (priceList[token]);
    }

}