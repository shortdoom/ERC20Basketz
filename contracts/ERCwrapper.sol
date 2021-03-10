pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

contract ercWrapper is ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _WrapIndex;

    mapping(address => UserIndex) wrapped;
    mapping(address => UserMap[]) mapped;

    struct UserMap {
        uint256 id;
        address[] tokens;
        uint256[] amounts;
        bool wrapOwner;
    }

    struct UserIndex {
        uint256 id;
        address[] tokens;
        uint256[] amounts;
        bool wrapOwner;
    }

    modifier onlyWrapOwner(){
        require(wrapped[msg.sender].wrapOwner);
        _;
    }

    constructor() ERC721("WrappedIndex", "WRAP") {}

    // Two options: Non-Fungible 721 (Transfer only whole amount), Fungible 1155 (Transfer parts). Second requires additional logic.

    function wrapperMapping(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {
        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
        }

        _WrapIndex.increment();
        uint256 wrapId = _WrapIndex.current();
        mapped[msg.sender].push(UserMap({id: wrapId, tokens: tokens, amounts: amounts, wrapOwner: true}));
        _mint(msg.sender, wrapId);
        // _setTokenURI(wrapId, "NFT-Location"); // Additional URI data can go here

        return wrapId;
    }

    function unwrapperMapping(uint256 _basketId) external onlyWrapOwner {
        // Lets say msg.sender owns basketId 1 & 2, but wants to unwrap only 2
        uint256 basketNo = ERC721.tokenOfOwnerByIndex(msg.sender, _basketId); // return given msg.sender basket

        for (uint256 i = 0; i < mapped[msg.sender][_basketId].tokens.length; i++) {
            IERC20(mapped[msg.sender][_basketId].tokens[i]).approve(address(this), mapped[msg.sender][_basketId].amounts[i]);
            bool success =
                IERC20(mapped[msg.sender][_basketId].tokens[i]).transferFrom(
                    address(this),
                    msg.sender,
                    mapped[msg.sender][_basketId].amounts[i]
                );
            require(success);
        }

        delete mapped[msg.sender][_basketId];
        _burn(basketNo);
    }

    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {
        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
        }

        _WrapIndex.increment();
        uint256 wrapId = _WrapIndex.current();
        wrapped[msg.sender] = UserIndex({ id: wrapId, tokens: tokens, amounts: amounts, wrapOwner: true });
        _mint(msg.sender, wrapId);
        // _setTokenURI(wrapId, "NFT-Location"); // Additional URI data can go here

        return wrapId;
    }

    function unwrapper(uint256 _basketId) external onlyWrapOwner {
        // Lets say msg.sender owns basketId 1 & 2, but wants to unwrap only 2
        uint256 basketNo = ERC721.tokenOfOwnerByIndex(msg.sender, _basketId); // return given msg.sender basket
        for (uint256 i = 0; i < wrapped[msg.sender].tokens.length; i++) {
            IERC20(wrapped[msg.sender].tokens[i]).approve(address(this), wrapped[msg.sender].amounts[i]);
            bool success =
                IERC20(wrapped[msg.sender].tokens[i]).transferFrom(
                    address(this),
                    msg.sender,
                    wrapped[msg.sender].amounts[i]
                );
            require(success);
        }

        delete wrapped[msg.sender];
        _burn(basketNo);
    }

    /**
    Override ERC721 functions to keep track of global storage variables.
    _transfer is modified to also remove user baskets upon change of ownership
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal onlyWrapOwner override {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer of token that is not own"); // internal owner
        require(to != address(0), "ERC721: transfer to the zero address");
        super._transfer(from, to, tokenId);
        wrapped[to] = wrapped[msg.sender]; // Copy UserIndex (token balance) from msg.sender (owner) to `to` (receiver)
        delete wrapped[msg.sender]; // delete UserIndex of original owner
    }

    function wrappedBalance(uint256 _tokenId)
        public
        view
        returns (
            uint256 id,
            address[] memory tokens,
            uint256[] memory amounts
        )
    {
        address owner = ERC721.ownerOf(_tokenId);
        return (wrapped[owner].id, wrapped[owner].tokens, wrapped[owner].amounts);
    }
}
