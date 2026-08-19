// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./Interfaces.sol";

contract CoverageVault {
    IERC20 public immutable asset;
    address public manager;
    address public immutable owner;
    uint256 public totalShares;
    uint256 public reserved;
    mapping(address => uint256) public shares;

    event Deposited(address indexed lp, uint256 assets, uint256 shares);
    event Withdrawn(address indexed lp, uint256 assets, uint256 shares);
    event Reserved(uint256 amount);
    event Released(uint256 amount);

    constructor(IERC20 asset_) {
        asset = asset_;
        owner = msg.sender;
    }

    modifier onlyManager() { require(msg.sender == manager, "manager"); _; }

    function setManager(address manager_) external {
        require(msg.sender == owner && manager == address(0) && manager_ != address(0), "manager");
        manager = manager_;
    }

    function totalAssets() public view returns (uint256) { return asset.balanceOf(address(this)); }
    function freeAssets() public view returns (uint256) { return totalAssets() - reserved; }

    function deposit(uint256 assets) external returns (uint256 minted) {
        uint256 assetsBefore = totalAssets();
        minted = totalShares == 0 ? assets : assets * totalShares / assetsBefore;
        require(minted > 0, "shares");
        require(asset.transferFrom(msg.sender, address(this), assets), "transfer");
        totalShares += minted;
        shares[msg.sender] += minted;
        emit Deposited(msg.sender, assets, minted);
    }

    function withdraw(uint256 shareAmount) external returns (uint256 assets) {
        require(shareAmount > 0 && shareAmount <= shares[msg.sender], "shares");
        assets = shareAmount * totalAssets() / totalShares;
        require(assets <= freeAssets(), "reserved");
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        require(asset.transfer(msg.sender, assets), "transfer");
        emit Withdrawn(msg.sender, assets, shareAmount);
    }

    function lock(uint256 amount) external onlyManager {
        require(amount <= freeAssets(), "liquidity");
        reserved += amount;
        emit Reserved(amount);
    }

    function release(uint256 amount) external onlyManager {
        require(amount <= reserved, "reserve");
        reserved -= amount;
        emit Released(amount);
    }

    function pay(address recipient, uint256 amount) external onlyManager {
        require(amount <= reserved, "reserve");
        reserved -= amount;
        require(asset.transfer(recipient, amount), "transfer");
    }

    function distributePremium(uint256 amount) external onlyManager {
        require(asset.transferFrom(msg.sender, address(this), amount), "premium");
    }
}
