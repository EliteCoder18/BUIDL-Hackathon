// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./Interfaces.sol";

contract UnderwriterRegistry {
    IERC20 public immutable asset;
    address public manager;
    address public immutable owner;
    mapping(address => uint256) public deposited;
    mapping(address => uint256) public locked;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    constructor(IERC20 asset_) {
        asset = asset_;
        owner = msg.sender;
    }

    modifier onlyManager() { require(msg.sender == manager, "manager"); _; }

    function setManager(address manager_) external {
        require(msg.sender == owner && manager == address(0) && manager_ != address(0), "manager");
        manager = manager_;
    }

    function deposit(uint256 amount) external {
        require(asset.transferFrom(msg.sender, address(this), amount), "transfer");
        deposited[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        require(deposited[msg.sender] - locked[msg.sender] >= amount, "locked");
        deposited[msg.sender] -= amount;
        require(asset.transfer(msg.sender, amount), "transfer");
    }

    function lock(address underwriter, uint256 amount) external onlyManager {
        require(deposited[underwriter] - locked[underwriter] >= amount, "stake");
        locked[underwriter] += amount;
    }

    function release(address underwriter, uint256 amount) external onlyManager {
        locked[underwriter] -= amount;
    }

    function slash(address underwriter, address recipient, uint256 amount) external onlyManager {
        locked[underwriter] -= amount;
        deposited[underwriter] -= amount;
        require(asset.transfer(recipient, amount), "transfer");
    }

    function useNonce(address underwriter, uint256 nonce) external onlyManager {
        require(!nonceUsed[underwriter][nonce], "nonce");
        nonceUsed[underwriter][nonce] = true;
    }
}
