// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice ERC-8004 identity registry is ERC-721 compatible for agent ownership.
interface IERC8004IdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @notice Venue-neutral execution boundary used by TreasuryJobManager.
interface IJobExecutor {
    function execute(
        IERC20 inputToken,
        IERC20 outputToken,
        uint256 amountIn,
        uint256 minOut,
        address recipient
    ) external returns (uint256 amountOut);
}

interface IAttestcoinOutcomeAdapter {
    function consumeOutcome(bytes32 jobKey) external returns (uint8 outcome);
}

interface IUnderwriterRegistry {
    function lock(address underwriter, uint256 amount) external;
    function release(address underwriter, uint256 amount) external;
    function slash(address underwriter, address recipient, uint256 amount) external;
    function useNonce(address underwriter, uint256 nonce) external;
}

interface ICoverageVault {
    function lock(uint256 amount) external;
    function release(uint256 amount) external;
    function pay(address recipient, uint256 amount) external;
    function distributePremium(uint256 amount) external;
}
