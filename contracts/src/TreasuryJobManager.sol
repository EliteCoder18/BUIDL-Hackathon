// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20, IERC8004IdentityRegistry, IJobExecutor} from "./Interfaces.sol";

contract TreasuryJobManager {
    enum Outcome { Pending, Success, Violation, Expired }

    struct Job {
        address client;
        address agent;
        uint256 agentId;
        address inputToken;
        address outputToken;
        address executor;
        uint256 amountIn;
        uint256 minOut;
        uint64 deadline;
        Outcome outcome;
    }

    uint256 public nextJobId;
    address public immutable admin;
    IERC8004IdentityRegistry public immutable identityRegistry;
    mapping(uint256 => Job) public jobs;
    mapping(address => bool) public approvedExecutors;

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed agent, uint256 amountIn, uint256 minOut, uint64 deadline);
    event JobSettled(uint256 indexed jobId, Outcome outcome, uint256 amountOut);
    event ExecutorApprovalChanged(address indexed executor, bool approved);

    constructor(IERC8004IdentityRegistry identityRegistry_) {
        require(address(identityRegistry_) != address(0), "registry");
        admin = msg.sender;
        identityRegistry = identityRegistry_;
    }

    function setExecutorApproval(address executor, bool approved) external {
        require(msg.sender == admin, "admin");
        require(executor != address(0), "executor");
        approvedExecutors[executor] = approved;
        emit ExecutorApprovalChanged(executor, approved);
    }

    function createJob(
        uint256 agentId,
        IERC20 inputToken,
        IERC20 outputToken,
        address executor,
        uint256 amountIn,
        uint256 minOut,
        uint64 deadline
    ) external returns (uint256 jobId) {
        address agent = identityRegistry.ownerOf(agentId);
        require(approvedExecutors[executor], "executor");
        require(amountIn > 0 && minOut > 0 && deadline > block.timestamp, "terms");
        require(inputToken.transferFrom(msg.sender, address(this), amountIn), "funding");
        jobId = nextJobId++;
        jobs[jobId] = Job(msg.sender, agent, agentId, address(inputToken), address(outputToken), executor, amountIn, minOut, deadline, Outcome.Pending);
        emit JobCreated(jobId, msg.sender, agent, amountIn, minOut, deadline);
    }

    function execute(uint256 jobId) external returns (uint256 amountOut) {
        Job storage job = jobs[jobId];
        require(job.outcome == Outcome.Pending, "settled");
        require(msg.sender == job.agent, "agent");
        if (block.timestamp > job.deadline) return _expire(jobId, job);
        IERC20 inputToken = IERC20(job.inputToken);
        IERC20 outputToken = IERC20(job.outputToken);
        uint256 outputBefore = outputToken.balanceOf(job.client);
        require(inputToken.approve(job.executor, job.amountIn), "approval");
        try IJobExecutor(job.executor).execute(inputToken, outputToken, job.amountIn, job.minOut, job.client) returns (uint256 reportedOut) {
            require(inputToken.approve(job.executor, 0), "approval reset");
            uint256 receivedOut = outputToken.balanceOf(job.client) - outputBefore;
            if (reportedOut < job.minOut || receivedOut < job.minOut) {
                job.outcome = Outcome.Violation;
                emit JobSettled(jobId, Outcome.Violation, receivedOut);
                return receivedOut;
            }
            job.outcome = Outcome.Success;
            emit JobSettled(jobId, Outcome.Success, receivedOut);
            return receivedOut;
        } catch {
            require(inputToken.approve(job.executor, 0), "approval reset");
            job.outcome = Outcome.Violation;
            require(inputToken.transfer(job.client, job.amountIn), "refund");
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
        require(IERC20(job.inputToken).transfer(job.client, job.amountIn), "refund");
        emit JobSettled(jobId, Outcome.Expired, 0);
        return 0;
    }
}
