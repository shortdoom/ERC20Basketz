pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ercWrapper is ERC1155{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // Ids
    // Id needs to be related to address, so check can be performed
    string public constant AAVE_TOKEN = "AAVE";
    string public constant SNX_TOKEN = "SNX";
    string public constant UNI_TOKEN = "UNI";
    uint256 public constant AAVE = 0;
    uint256 public constant SNX = 1;
    uint256 public constant UNI = 2;
    
    mapping(address => UserIndex[]) wrapped;

    struct UserIndex {
        address[] tokens;
        uint256[] amounts;
    }
    constructor (string memory _uri) ERC1155 (_uri) {

    }

    // User approves wrapper
    // Wrapper takes tokens
    // `Puts` (mints) in ERC1155
    // Gives User ERC1155
    // ERC1155 linked to balanceOf Tokens sent
    // User calls unwrapper
    // Unwrapper sends tokens 

    // Two options: Non-Fungible 721 (Transfer only whole amount), Fungible 1155 (Transfer parts). Second requires additional logic.

    function wrapper(address[] memory tokens, uint256[] memory amounts) external {
        uint256 total;

        for (uint256 i = 0; i < tokens.length; i++) {
            bool success = IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
            require(success);
            total = total.add(amounts[i]);
            uint256 newItemId = tokenId(tokens[i]);
            _mint(msg.sender, newItemId, total, ""); // 0x111 has wAAVE in amount N, where wAAVE is an ID
                                                     // It needs to mint on each token, corresponding NFT, then use BatchTransfer
        }
        wrapped[msg.sender].push(UserIndex({tokens: tokens, amounts: amounts}));
    }

    function tokenId(string memory _token) public view returns (uint256 id) {
        if (_token == "AAVE") {            
            return 0;
            }
    }

    function unwrapper() external {
        // require(msg.sender) // to be an owner of NFT
    }

}