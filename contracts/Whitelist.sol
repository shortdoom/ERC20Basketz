pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

    /**
    Whitelist should be initialized at deployment.
    Constructor creates a list of available price feeds for chainlink.
    This contract is only called in relation to chainlink feed.
    https://docs.chain.link/docs/ethereum-addresses
     */

contract Whitelist {

    // token => feed
    mapping(address => address) public priceList;

    constructor(
        address[] memory tokens,
        address[] memory feeds
    ) {

        for (uint256 i = 0; i < tokens.length; i++) {
            priceList[tokens[i]] = feeds[i];
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