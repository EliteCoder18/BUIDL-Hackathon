// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC8004IdentityRegistry} from "./Interfaces.sol";

/// @notice Test-only ERC-721-shaped identity registry. Use the official registry on Sepolia.
contract MockERC8004IdentityRegistry is IERC8004IdentityRegistry {
    uint256 public nextAgentId;
    mapping(uint256 => address) private owners;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function mint(address owner) external returns (uint256 agentId) {
        require(owner != address(0), "owner");
        agentId = nextAgentId++;
        owners[agentId] = owner;
        emit Transfer(address(0), owner, agentId);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        address owner = owners[agentId];
        require(owner != address(0), "agent");
        return owner;
    }
}
