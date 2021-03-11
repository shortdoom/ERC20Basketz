pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ercWrapper is ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    Counters.Counter private _wrapID;

    mapping(address => mapping (uint256 => UserIndex)) private wrapped; 

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
    }

    constructor() ERC721("WrappedIndex", "WRAP") {}

    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns (uint256) {
        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
        }

        // NOTE: Probably there is some better way to manage wrapId/tokenId
        _wrapID.increment();
        uint256 wrapId = _wrapID.current();
        wrapped[msg.sender][wrapId] = UserIndex({tokens: tokens, amounts: amounts});
        _mint(msg.sender, wrapId);
        // NOTE: URI. Maybe off-chain stats, lightweight analysis of basket price change etc.

        return wrapId;
    }

    function unwrapper(uint256 _wrapId) external {
        require(ERC721.ownerOf(_wrapId) == msg.sender, "Not an owner of a basket");
        for (uint256 i = 0; i < wrapped[msg.sender][_wrapId].tokens.length; i++) {
            IERC20(wrapped[msg.sender][_wrapId].tokens[i]).approve(address(this), wrapped[msg.sender][_wrapId].amounts[i]);
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
        require(ERC721.ownerOf( _wrapId) == from, "ERC721: transfer of token that is not own"); // internal owner
        require(to != address(0), "ERC721: transfer to the zero address");
        super._transfer(from, to,  _wrapId);
        wrapped[to][ _wrapId] = wrapped[msg.sender][ _wrapId]; // Copy UserIndex (token balance) from msg.sender (owner) to `to` (receiver)
        delete wrapped[msg.sender][_wrapId]; // delete UserIndex of original owner
    }

    function wrappedBalance(uint256  _wrapId)
        public
        view
        returns (
            uint256 id,
            address[] memory tokens,
            uint256[] memory amounts
        )
    {
        address owner = ERC721.ownerOf( _wrapId);
        return ( _wrapId, wrapped[owner][ _wrapId].tokens, wrapped[owner][ _wrapId].amounts);
    }

}
