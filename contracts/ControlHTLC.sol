pragma solidity 0.7.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./AccessHTLC.sol";

contract ControlHTLC is AccessHTLC{

    event HTLCERC721New(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        address tokenContract,
        uint256 tokenId,
        bytes32 hashlock,
        uint256 timelock
    );
    event HTLCERC721Withdraw(bytes32 indexed contractId);
    event HTLCERC721Refund(bytes32 indexed contractId);

    modifier tokensTransferable(address _token, uint256 _tokenId) {
        // ensure this contract is approved to transfer the designated token
        // so that it is able to honor the claim request later
        require(
            IERC721(_token).getApproved(_tokenId) == address(this),
            "The HTLC must have been designated an approved spender for the tokenId"
        );
        _;
    }
    modifier futureTimelock(uint256 _time) {
        // only requirement is the timelock time is after the last blocktime (now).
        // probably want something a bit further in the future then this.
        // but this is still a useful sanity check:
        require(_time > block.timestamp, "timelock time must be in the future");
        _;
    }
    modifier contractExists(bytes32 _contractId) {
        require(super.haveContract(_contractId), "contractId does not exist");
        _;
    }
    modifier hashlockMatches(bytes32 _contractId, bytes32 _x) {
        require(
            AccessHTLC.contracts[_contractId].hashlock == sha256(abi.encodePacked(_x)),
            "hashlock hash does not match"
        );
        _;
    }
    modifier withdrawable(bytes32 _contractId) {
        require(AccessHTLC.contracts[_contractId].receiver == msg.sender, "withdrawable: not receiver");
        require(AccessHTLC.contracts[_contractId].withdrawn == false, "withdrawable: already withdrawn");
        // if we want to disallow claim to be made after the timeout, uncomment the following line
        // require(contracts[_contractId].timelock > now, "withdrawable: timelock time must be in the future");
        _;
    }
    modifier refundable(bytes32 _contractId) {
        require(AccessHTLC.contracts[_contractId].sender == msg.sender, "refundable: not sender");
        require(AccessHTLC.contracts[_contractId].refunded == false, "refundable: already refunded");
        require(AccessHTLC.contracts[_contractId].withdrawn == false, "refundable: already withdrawn");
        require(AccessHTLC.contracts[_contractId].timelock <= block.timestamp, "refundable: timelock not yet passed");
        _;
    }
}

