// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./Interfaces.sol";

interface IJobDEX {
    function swap(uint256 amountIn, uint256 minOut, address recipient) external returns (uint256 amountOut);
}

contract TreasuryJobManager {
    enum Outcome { Pending, Success, Violation, Expired }

    struct Job {
        address client;
        address agent;
        address inputToken;
        address outputToken;
        address dex;
        uint256 amountIn;
        uint256 minOut;
        uint64 deadline;
        Outcome outcome;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed agent, uint256 amountIn, uint256 minOut, uint64 deadline);
    event JobSettled(uint256 indexed jobId, Outcome outcome, uint256 amountOut);

    function createJob(
        address agent,
        IERC20 inputToken,
        IERC20 outputToken,
        address dex,
        uint256 amountIn,
        uint256 minOut,
        uint64 deadline
    ) external returns (uint256 jobId) {
        require(agent != address(0) && dex != address(0), "address");
        require(amountIn > 0 && minOut > 0 && deadline > block.timestamp, "terms");
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "funding");
        jobId = nextJobId++;
        jobs[jobId] = Job(msg.sender, agent, address(inputToken), address(outputToken), dex, amountIn, minOut, deadline, Outcome.Pending);
        emit JobCreated(jobId, msg.sender, agent, amountIn, minOut, deadline);
    }

    function execute(uint256 jobId) external returns (uint256 amountOut) {
        Job storage job = jobs[jobId];
        require(job.outcome == Outcome.Pending, "settled");
        require(msg.sender == job.agent, "agent");
        if (block.timestamp > job.deadline) return _expire(jobId, job);
        IERC20(job.inputToken).approve(job.dex, job.amountIn);
        try IJobDEX(job.dex).swap(job.amountIn, job.minOut, job.client) returns (uint256 out) {
            job.outcome = Outcome.Success;
            emit JobSettled(jobId, Outcome.Success, out);
            return out;
        } catch {
            job.outcome = Outcome.Violation;
            IERC20(job.inputToken).transfer(job.client, job.amountIn);
            emit JobSettled(jobId, Outcome.Violation, 0);
            return 0;
        }
    }

    function finalizeExpired(uint256 jobId) external returns (uint256) {
        Job storage job = jobs[jobId];
        require(job.outcome == Outcome.Pending, "settled");
        require(block.timestamp > job.deadline, "not expired");
        return _expire(jobId, job);
    }

    function jobKey(uint256 jobId) external view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), jobId));
    }

    function _expire(uint256 jobId, Job storage job) private returns (uint256) {
        job.outcome = Outcome.Expired;
        IERC20(job.inputToken).transfer(job.client, job.amountIn);
        emit JobSettled(jobId, Outcome.Expired, 0);
        return 0;
    }
}
