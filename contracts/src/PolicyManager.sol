// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20, IAttestcoinOutcomeAdapter, IUnderwriterRegistry, ICoverageVault} from "./Interfaces.sol";

contract PolicyManager {
    enum PolicyState { None, Active, SettledSuccess, SettledFailure }

    struct Quote {
        bytes32 jobKey;
        address underwriter;
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 juniorAmount;
        uint64 validUntil;
        bytes32 modelHash;
        uint256 nonce;
    }

    struct Policy {
        address client;
        address underwriter;
        bytes32 jobKey;
        uint256 coverageAmount;
        uint256 premiumAmount;
        uint256 juniorAmount;
        uint256 seniorAmount;
        PolicyState state;
    }

    bytes32 public constant QUOTE_TYPEHASH = keccak256("Quote(bytes32 jobKey,address underwriter,uint256 coverageAmount,uint256 premiumAmount,uint256 juniorAmount,uint64 validUntil,bytes32 modelHash,uint256 nonce)");
    bytes32 public immutable DOMAIN_SEPARATOR;
    uint256 public immutable maxCoverage;
    IERC20 public immutable asset;
    IUnderwriterRegistry public immutable registry;
    ICoverageVault public immutable vault;
    IAttestcoinOutcomeAdapter public immutable outcomeAdapter;
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => bool) public jobBound;
    bool private entered;

    event PolicyAccepted(bytes32 indexed policyId, bytes32 indexed jobKey, address indexed client, address underwriter, uint256 coverageAmount, uint256 premiumAmount);
    event PolicySettled(bytes32 indexed policyId, PolicyState state, uint256 clientPayout);

    modifier nonReentrant() { require(!entered, "reentrant"); entered = true; _; entered = false; }

    constructor(
        IERC20 asset_,
        IUnderwriterRegistry registry_,
        ICoverageVault vault_,
        IAttestcoinOutcomeAdapter outcomeAdapter_,
        uint256 maxCoverage_
    ) {
        asset = asset_;
        registry = registry_;
        vault = vault_;
        outcomeAdapter = outcomeAdapter_;
        maxCoverage = maxCoverage_;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("TrustFutures")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function policyId(Quote calldata quote) public pure returns (bytes32) {
        return keccak256(abi.encode(quote.jobKey, quote.underwriter, quote.nonce));
    }

    function quoteDigest(Quote calldata quote) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            QUOTE_TYPEHASH,
            quote.jobKey,
            quote.underwriter,
            quote.coverageAmount,
            quote.premiumAmount,
            quote.juniorAmount,
            quote.validUntil,
            quote.modelHash,
            quote.nonce
        ));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function acceptQuote(Quote calldata quote, bytes calldata signature) external nonReentrant returns (bytes32 id) {
        require(block.timestamp <= quote.validUntil, "expired");
        require(quote.coverageAmount > 0 && quote.coverageAmount <= maxCoverage, "coverage");
        require(quote.juniorAmount * 5 == quote.coverageAmount, "junior 20%");
        require(!jobBound[quote.jobKey], "job bound");
        require(_recover(quoteDigest(quote), signature) == quote.underwriter, "signature");

        uint256 seniorAmount = quote.coverageAmount - quote.juniorAmount;
        id = policyId(quote);
        require(policies[id].state == PolicyState.None, "policy");
        registry.useNonce(quote.underwriter, quote.nonce);
        registry.lock(quote.underwriter, quote.juniorAmount);
        vault.lock(seniorAmount);
        require(asset.transferFrom(msg.sender, address(this), quote.premiumAmount), "premium");

        jobBound[quote.jobKey] = true;
        policies[id] = Policy(msg.sender, quote.underwriter, quote.jobKey, quote.coverageAmount, quote.premiumAmount, quote.juniorAmount, seniorAmount, PolicyState.Active);
        emit PolicyAccepted(id, quote.jobKey, msg.sender, quote.underwriter, quote.coverageAmount, quote.premiumAmount);
    }

    function settle(bytes32 id) external nonReentrant {
        Policy storage policy = policies[id];
        require(policy.state == PolicyState.Active, "policy");
        uint8 outcome = outcomeAdapter.consumeOutcome(policy.jobKey);
        if (outcome == 1) {
            policy.state = PolicyState.SettledSuccess;
            registry.release(policy.underwriter, policy.juniorAmount);
            vault.release(policy.seniorAmount);
            uint256 underwriterPremium = policy.premiumAmount * 3 / 10;
            require(asset.transfer(policy.underwriter, underwriterPremium), "premium");
            require(asset.transfer(address(vault), policy.premiumAmount - underwriterPremium), "premium");
            emit PolicySettled(id, PolicyState.SettledSuccess, 0);
            return;
        }
        policy.state = PolicyState.SettledFailure;
        registry.slash(policy.underwriter, policy.client, policy.juniorAmount);
        vault.pay(policy.client, policy.seniorAmount);
        emit PolicySettled(id, PolicyState.SettledFailure, policy.coverageAmount);
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "signature v");
        return ecrecover(digest, v, r, s);
    }
}
