// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20, IJobExecutor} from "./Interfaces.sol";

interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Minimal adapter for a V3-compatible exactInputSingle router.
contract UniswapV3Executor is IJobExecutor {
    IUniswapV3SwapRouter public immutable router;
    uint24 public immutable poolFee;

    constructor(IUniswapV3SwapRouter router_, uint24 poolFee_) {
        require(address(router_) != address(0), "router");
        require(poolFee_ > 0, "fee");
        router = router_;
        poolFee = poolFee_;
    }

    function execute(
        IERC20 inputToken,
        IERC20 outputToken,
        uint256 amountIn,
        uint256 minOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(address(inputToken) != address(outputToken), "token pair");
        require(recipient != address(0), "recipient");
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "input");
        require(inputToken.approve(address(router), amountIn), "router approval");
        amountOut = router.exactInputSingle(IUniswapV3SwapRouter.ExactInputSingleParams({
            tokenIn: address(inputToken),
            tokenOut: address(outputToken),
            fee: poolFee,
            recipient: recipient,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        }));
        require(amountOut >= minOut, "min out");
        require(inputToken.approve(address(router), 0), "router approval reset");
    }
}
