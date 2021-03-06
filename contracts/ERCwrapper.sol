pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

// import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ercWrapper is ERC721{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

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

    function wrapper(address[] memory tokens, uint256[] memory amounts) external returns(uint256) {

        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
        }
        
        _WrapIndex.increment();            
        uint256 wrapId = _WrapIndex.current();
        wrapped[msg.sender] = UserIndex({id: wrapId, tokens: tokens, amounts: amounts});
        _mint(msg.sender, wrapId);
        _setTokenURI(wrapId, "NFT-Location");

        return wrapId;
    }

    function unwrapper(uint256 _id, address _withdraw) external {
        // Only owner of nft should be able to call and only to his address
        // Contract has tokens
    }

    function wrappedBalance() public view returns(uint256 id, address[] memory tokens, uint256[] memory amounts) {
        return (wrapped[msg.sender].id, wrapped[msg.sender].tokens, wrapped[msg.sender].amounts);
    }

}

    // User approves wrapper
    // Wrapper takes tokens
    // `Puts` (mints) in ERC1155
    // Gives User ERC1155
    // ERC1155 linked to balanceOf Tokens sent
    // User calls unwrapper
    // Unwrapper sends tokens 