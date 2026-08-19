// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Local-test adapter only; production policies use AttestcoinOutcomeAdapter.
contract MockOutcomeAdapter {
    mapping(bytes32 => uint8) public outcomes;
    mapping(bytes32 => bool) public consumed;

    function setOutcome(bytes32 jobKey, uint8 outcome) external {
        require(outcome == 1 || outcome == 2 || outcome == 3, "outcome");
        outcomes[jobKey] = outcome;
    }

    function consumeOutcome(bytes32 jobKey) external returns (uint8) {
        require(!consumed[jobKey] && outcomes[jobKey] != 0, "outcome");
        consumed[jobKey] = true;
        return outcomes[jobKey];
    }
}
