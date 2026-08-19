// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof { bytes32 lowerEndpointDigest; bytes32[] roots; }
    function verifyAndEmit(uint64 chainKey, uint64 height, bytes calldata encodedTransaction, MerkleProof calldata merkleProof, ContinuityProof calldata continuityProof) external returns (bool);
    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}

/// @notice Minimal CC3 USC proof gate, adapted from Gluwa's bridge examples.
abstract contract USCBase {
    INativeQueryVerifier internal constant VERIFIER = INativeQueryVerifier(0x0000000000000000000000000000000000000FD2);
    mapping(bytes32 => bool) public processedQueries;
    function _processVerifiedTransaction(bytes32 queryId, bytes memory encodedTransaction) internal virtual;
    function _validateChainKey(uint64 chainKey) internal view virtual;

    function execute(uint8 action, uint64 chainKey, uint64 blockHeight, bytes calldata encodedTransaction, bytes32 merkleRoot, INativeQueryVerifier.MerkleProofEntry[] calldata siblings, bytes32 lowerEndpointDigest, bytes32[] calldata continuityRoots) external returns (bool) {
        require(action == 0, "action");
        _validateChainKey(chainKey);
        INativeQueryVerifier.MerkleProof memory proof = INativeQueryVerifier.MerkleProof(merkleRoot, siblings);
        bytes32 queryId = keccak256(abi.encode(chainKey, blockHeight, VERIFIER.calculateTxIndex(proof)));
        require(!processedQueries[queryId], "proof replay");
        INativeQueryVerifier.ContinuityProof memory continuity = INativeQueryVerifier.ContinuityProof(lowerEndpointDigest, continuityRoots);
        require(VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, proof, continuity), "invalid proof");
        processedQueries[queryId] = true;
        _processVerifiedTransaction(queryId, encodedTransaction);
        return true;
    }
}
