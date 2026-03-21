// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * ══════════════════════════════════════════════════════════════════
 *  LineageReputationRegistry — On-Chain Agent Reputation & Feedback
 * ══════════════════════════════════════════════════════════════════
 *
 *  Implements an ERC-8004 compatible Reputation Registry:
 *    - Any wallet can submit a score (1–5) + comment for any agent
 *    - One active review per reviewer per agent (updateable)
 *    - Aggregated scores available on-chain (average, count)
 *    - Events for indexing
 *
 *  Deployed on Base Sepolia for the Lineage platform.
 * ══════════════════════════════════════════════════════════════════
 */
contract LineageReputationRegistry {

    // ── Structs ──────────────────────────────────────────────────

    struct Feedback {
        address reviewer;
        uint256 agentTokenId;
        uint8 score;          // 1–5
        string comment;
        uint256 timestamp;
        bool exists;
    }

    // ── State ────────────────────────────────────────────────────

    /// @dev agentTokenId => all feedback entries
    mapping(uint256 => Feedback[]) private _feedbackList;

    /// @dev agentTokenId => reviewer => index in _feedbackList (1-indexed, 0 = no entry)
    mapping(uint256 => mapping(address => uint256)) private _reviewerIndex;

    /// @dev agentTokenId => running total of scores
    mapping(uint256 => uint256) private _scoreTotals;

    /// @dev agentTokenId => count of reviews
    mapping(uint256 => uint256) private _reviewCounts;

    // ── Events ───────────────────────────────────────────────────

    event FeedbackSubmitted(
        uint256 indexed agentTokenId,
        address indexed reviewer,
        uint8 score,
        string comment
    );

    event FeedbackUpdated(
        uint256 indexed agentTokenId,
        address indexed reviewer,
        uint8 oldScore,
        uint8 newScore,
        string comment
    );

    // ── Submit / Update Feedback ─────────────────────────────────

    /**
     * @notice Submit or update feedback for an agent.
     * @param agentTokenId  The ERC-8004 agent token ID being reviewed.
     * @param score         Rating from 1 to 5.
     * @param comment       Free-text review comment.
     */
    function submitFeedback(
        uint256 agentTokenId,
        uint8 score,
        string calldata comment
    ) external {
        require(score >= 1 && score <= 5, "Score must be 1-5");
        require(agentTokenId > 0, "Invalid agent token ID");

        uint256 existingIdx = _reviewerIndex[agentTokenId][msg.sender];

        if (existingIdx > 0) {
            // Update existing review
            Feedback storage existing = _feedbackList[agentTokenId][existingIdx - 1];
            uint8 oldScore = existing.score;

            // Update running total
            _scoreTotals[agentTokenId] = _scoreTotals[agentTokenId] - oldScore + score;

            existing.score = score;
            existing.comment = comment;
            existing.timestamp = block.timestamp;

            emit FeedbackUpdated(agentTokenId, msg.sender, oldScore, score, comment);
        } else {
            // New review
            _feedbackList[agentTokenId].push(Feedback({
                reviewer: msg.sender,
                agentTokenId: agentTokenId,
                score: score,
                comment: comment,
                timestamp: block.timestamp,
                exists: true
            }));

            _reviewerIndex[agentTokenId][msg.sender] = _feedbackList[agentTokenId].length;
            _scoreTotals[agentTokenId] += score;
            _reviewCounts[agentTokenId]++;

            emit FeedbackSubmitted(agentTokenId, msg.sender, score, comment);
        }
    }

    // ── Read Functions ───────────────────────────────────────────

    /**
     * @notice Get the aggregated reputation score for an agent.
     * @return avg   Average score scaled by 100 (e.g., 450 = 4.50)
     * @return count Total number of reviews
     */
    function getAverageScore(uint256 agentTokenId)
        external view returns (uint256 avg, uint256 count)
    {
        count = _reviewCounts[agentTokenId];
        if (count == 0) return (0, 0);
        avg = (_scoreTotals[agentTokenId] * 100) / count;
    }

    /**
     * @notice Get a single feedback entry by agent and index.
     */
    function getFeedbackAt(uint256 agentTokenId, uint256 index)
        external view returns (Feedback memory)
    {
        require(index < _feedbackList[agentTokenId].length, "Index out of range");
        return _feedbackList[agentTokenId][index];
    }

    /**
     * @notice Get a page of feedback entries for an agent.
     * @param offset Start index
     * @param limit  Max entries to return
     */
    function getFeedback(uint256 agentTokenId, uint256 offset, uint256 limit)
        external view returns (Feedback[] memory results)
    {
        Feedback[] storage all = _feedbackList[agentTokenId];
        if (offset >= all.length) return new Feedback[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        uint256 size = end - offset;

        results = new Feedback[](size);
        for (uint256 i = 0; i < size; i++) {
            results[i] = all[offset + i];
        }
    }

    /**
     * @notice Get total number of reviews for an agent.
     */
    function getReviewCount(uint256 agentTokenId) external view returns (uint256) {
        return _reviewCounts[agentTokenId];
    }

    /**
     * @notice Get the existing review by a specific reviewer for an agent.
     */
    function getReviewByReviewer(uint256 agentTokenId, address reviewer)
        external view returns (Feedback memory)
    {
        uint256 idx = _reviewerIndex[agentTokenId][reviewer];
        require(idx > 0, "No review from this reviewer");
        return _feedbackList[agentTokenId][idx - 1];
    }

    /**
     * @notice Check if a reviewer has already reviewed an agent.
     */
    function hasReviewed(uint256 agentTokenId, address reviewer)
        external view returns (bool)
    {
        return _reviewerIndex[agentTokenId][reviewer] > 0;
    }
}
