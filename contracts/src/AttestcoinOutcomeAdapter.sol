// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {USCBase} from "./USCBase.sol";

/// @notice Turns an Attestcoin-proven Sepolia JobSettled event into one Creditcoin outcome.
contract AttestcoinOutcomeAdapter is USCBase {
    bytes32 public constant JOB_SETTLED = keccak256("JobSettled(uint256,uint8,uint256)");

    address public immutable sourceJobManager;
    uint256 public immutable sourceChainId;
    uint64 public immutable sourceChainKey;
    mapping(bytes32 => uint8) public provenOutcome;
    mapping(bytes32 => bool) public consumed;

    event OutcomeProven(bytes32 indexed jobKey, uint8 outcome, bytes32 indexed queryId);
    event OutcomeConsumed(bytes32 indexed jobKey, uint8 outcome);

    constructor(address sourceJobManager_, uint256 sourceChainId_, uint64 sourceChainKey_) {
        require(sourceJobManager_ != address(0), "source");
        sourceJobManager = sourceJobManager_;
        sourceChainId = sourceChainId_;
        sourceChainKey = sourceChainKey_;
    }

    function consumeOutcome(bytes32 jobKey) external returns (uint8 outcome) {
        require(!consumed[jobKey], "consumed");
        outcome = provenOutcome[jobKey];
        require(outcome == 1 || outcome == 2 || outcome == 3, "unproven");
        consumed[jobKey] = true;
        emit OutcomeConsumed(jobKey, outcome);
    }

    function _validateChainKey(uint64 chainKey) internal view override {
        require(chainKey == sourceChainKey, "chain");
    }

    function _processVerifiedTransaction(bytes32 queryId, bytes memory encodedTransaction) internal override {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "source tx failed");
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, JOB_SETTLED);
        require(logs.length == 1, "settled event");
        EvmV1Decoder.LogEntry memory settled = logs[0];
        require(settled.address_ == sourceJobManager && settled.topics.length == 2, "false source");
        uint256 jobId = uint256(settled.topics[1]);
        (uint8 outcome,) = abi.decode(settled.data, (uint8, uint256));
        require(outcome == 1 || outcome == 2 || outcome == 3, "outcome");
        bytes32 jobKey = keccak256(abi.encode(sourceChainId, sourceJobManager, jobId));
        require(provenOutcome[jobKey] == 0, "job already proven");
        provenOutcome[jobKey] = outcome;
        emit OutcomeProven(jobKey, outcome, queryId);
    }
}
