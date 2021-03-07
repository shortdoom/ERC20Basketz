pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ercWrapper is ERC721{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableMap for EnumerableMap.UintToAddressMap;

    mapping (address => EnumerableSet.UintSet) private _holderTokens;
    EnumerableMap.UintToAddressMap private _tokenOwners;

    Counters.Counter private _WrapIndex;
    
    mapping(address => UserIndex) wrapped;

    struct UserIndex {
        uint256 id;
        address[] tokens;
        uint256[] amounts;
    }

    constructor () ERC721("WrappedIndex", "WRAP") {
    }

    // Two options: Non-Fungible 721 (Transfer only whole amount), Fungible 1155 (Transfer parts). Second requires additional logic.

    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {

        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
        }
        
        _WrapIndex.increment();            
        uint256 wrapId = _WrapIndex.current();
        wrapped[msg.sender] = UserIndex({id: wrapId, tokens: tokens, amounts: amounts});
        _mint(msg.sender, wrapId);
        _setTokenURI(wrapId, "NFT-Location"); // Additional URI data can go here

        return wrapId;
    }

    function unwrapper() external {
        // Only NFT current holder should be able to call this function
        uint256 id = wrapped[msg.sender].id;

        for (uint256 i = 0; i < wrapped[msg.sender].tokens.length; i++) {
            IERC20(wrapped[msg.sender].tokens[i]).approve(address(this), wrapped[msg.sender].amounts[i]);
            bool success = IERC20(wrapped[msg.sender].tokens[i]).transferFrom(address(this), msg.sender, wrapped[msg.sender].amounts[i]);
            require(success);
        }

        delete wrapped[msg.sender];
        _burn(id);
    }

    function _transfer(address from, address to, uint256 tokenId) internal override {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer of token that is not own"); // internal owner
        require(to != address(0), "ERC721: transfer to the zero address");

        _beforeTokenTransfer(from, to, tokenId);
        _approve(address(0), tokenId);

        _holderTokens[from].remove(tokenId);
        _holderTokens[to].add(tokenId);

        // This works as intended
        wrapped[to] = wrapped[msg.sender];
        delete wrapped[msg.sender];

        _tokenOwners.set(tokenId, to);

        emit Transfer(from, to, tokenId);
    }

    // Override all neccessary methods, not only balanceOf (inherited contract still has access to private variables)
    function balanceOf(address owner) public view override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _holderTokens[owner].length();
    }

    function wrappedBalance() public view returns(uint256 id, address[] memory tokens, uint256[] memory amounts) {
        return (wrapped[msg.sender].id, wrapped[msg.sender].tokens, wrapped[msg.sender].amounts);
    }

}