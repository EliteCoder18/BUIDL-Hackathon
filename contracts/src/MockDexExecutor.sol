// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20, IJobExecutor} from "./Interfaces.sol";

interface IMockDEX {
    function inputToken() external view returns (IERC20);
    function outputToken() external view returns (IERC20);
    function swap(uint256 amountIn, uint256 minOut, address recipient) external returns (uint256 amountOut);
}

/// @notice Deterministic adapter retained for repeatable success and failure demos.
contract MockDexExecutor is IJobExecutor {
    IMockDEX public immutable dex;

    constructor(IMockDEX dex_) {
        require(address(dex_) != address(0), "dex");
        dex = dex_;
    }

    function execute(
        IERC20 inputToken,
        IERC20 outputToken,
        uint256 amountIn,
        uint256 minOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(address(inputToken) == address(dex.inputToken()), "input token");
        require(address(outputToken) == address(dex.outputToken()), "output token");
        require(recipient != address(0), "recipient");
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "input");
        require(inputToken.approve(address(dex), amountIn), "dex approval");
        amountOut = dex.swap(amountIn, minOut, recipient);
        require(inputToken.approve(address(dex), 0), "dex approval reset");
    }
}
