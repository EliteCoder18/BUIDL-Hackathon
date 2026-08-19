// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./Interfaces.sol";

contract MockDEX {
    IERC20 public immutable inputToken;
    IERC20 public immutable outputToken;
    address public immutable admin;
    uint256 public outputBps = 10_000;

    event RateChanged(uint256 outputBps);

    constructor(IERC20 inputToken_, IERC20 outputToken_) {
        inputToken = inputToken_;
        outputToken = outputToken_;
        admin = msg.sender;
    }

    function setOutputBps(uint256 outputBps_) external {
        require(msg.sender == admin, "admin");
        require(outputBps_ <= 20_000, "rate");
        outputBps = outputBps_;
        emit RateChanged(outputBps_);
    }

    function swap(uint256 amountIn, uint256 minOut, address recipient) external returns (uint256 amountOut) {
        amountOut = amountIn * outputBps / 10_000;
        require(amountOut >= minOut, "min out");
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "input");
        require(outputToken.transfer(recipient, amountOut), "output");
    }
}
