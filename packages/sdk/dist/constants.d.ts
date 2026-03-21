/**
 * ============================================================
 *  @agenttrust/sdk — Constants & ABIs
 * ============================================================
 */
export declare const AGENT_REGISTRY_ABI: readonly [{
    readonly name: "mintAgent";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "string";
        readonly name: "agentURI";
    }, {
        readonly type: "string";
        readonly name: "ethosProfile";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "setAgentURI";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentId";
    }, {
        readonly type: "string";
        readonly name: "agentURI";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "agentURI";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentId";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "ethosProfile";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentId";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "isActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "AgentMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "string";
        readonly name: "ethosProfile";
    }, {
        readonly type: "string";
        readonly name: "agentURI";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }];
}];
export declare const LINK_REGISTRY_ABI: readonly [{
    readonly name: "createVerifiedLink";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "agentWallet";
    }, {
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "uint256";
        readonly name: "ethosProfileId";
    }, {
        readonly type: "uint8";
        readonly name: "role";
    }, {
        readonly type: "uint256";
        readonly name: "expiration";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "bytes";
        readonly name: "humanSignature";
    }, {
        readonly type: "bytes";
        readonly name: "agentSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "upgradeLink";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "linkId";
    }, {
        readonly type: "bytes";
        readonly name: "signature";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "revokeLink";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "linkId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getLink";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "linkId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "linkId";
        }, {
            readonly type: "address";
            readonly name: "agentWallet";
        }, {
            readonly type: "uint256";
            readonly name: "agentTokenId";
        }, {
            readonly type: "address";
            readonly name: "humanWallet";
        }, {
            readonly type: "uint256";
            readonly name: "ethosProfileId";
        }, {
            readonly type: "uint8";
            readonly name: "role";
        }, {
            readonly type: "uint8";
            readonly name: "level";
        }, {
            readonly type: "uint8";
            readonly name: "status";
        }, {
            readonly type: "uint256";
            readonly name: "createdAt";
        }, {
            readonly type: "uint256";
            readonly name: "expiration";
        }, {
            readonly type: "bytes";
            readonly name: "humanSignature";
        }, {
            readonly type: "bytes";
            readonly name: "agentSignature";
        }];
    }];
}, {
    readonly name: "getAgentLinks";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "agentWallet";
    }, {
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "getActiveAgentLinks";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "agentWallet";
    }, {
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "linkId";
        }, {
            readonly type: "address";
            readonly name: "agentWallet";
        }, {
            readonly type: "uint256";
            readonly name: "agentTokenId";
        }, {
            readonly type: "address";
            readonly name: "humanWallet";
        }, {
            readonly type: "uint256";
            readonly name: "ethosProfileId";
        }, {
            readonly type: "uint8";
            readonly name: "role";
        }, {
            readonly type: "uint8";
            readonly name: "level";
        }, {
            readonly type: "uint8";
            readonly name: "status";
        }, {
            readonly type: "uint256";
            readonly name: "createdAt";
        }, {
            readonly type: "uint256";
            readonly name: "expiration";
        }, {
            readonly type: "bytes";
            readonly name: "humanSignature";
        }, {
            readonly type: "bytes";
            readonly name: "agentSignature";
        }];
    }];
}, {
    readonly name: "getHumanLinks";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "humanWallet";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "getProfileLinks";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "ethosProfileId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "isLinkActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "linkId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "nonces";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getDomainSeparator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "totalLinks";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export declare const REPUTATION_REGISTRY_ABI: readonly [{
    readonly name: "submitFeedback";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "uint8";
        readonly name: "score";
    }, {
        readonly type: "string";
        readonly name: "comment";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getAverageScore";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "avg";
    }, {
        readonly type: "uint256";
        readonly name: "count";
    }];
}, {
    readonly name: "getFeedbackAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "uint256";
        readonly name: "index";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "reviewer";
        }, {
            readonly type: "uint256";
            readonly name: "agentTokenId";
        }, {
            readonly type: "uint8";
            readonly name: "score";
        }, {
            readonly type: "string";
            readonly name: "comment";
        }, {
            readonly type: "uint256";
            readonly name: "timestamp";
        }, {
            readonly type: "bool";
            readonly name: "exists";
        }];
    }];
}, {
    readonly name: "getFeedback";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "uint256";
        readonly name: "offset";
    }, {
        readonly type: "uint256";
        readonly name: "limit";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "reviewer";
        }, {
            readonly type: "uint256";
            readonly name: "agentTokenId";
        }, {
            readonly type: "uint8";
            readonly name: "score";
        }, {
            readonly type: "string";
            readonly name: "comment";
        }, {
            readonly type: "uint256";
            readonly name: "timestamp";
        }, {
            readonly type: "bool";
            readonly name: "exists";
        }];
    }];
}, {
    readonly name: "getReviewCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getReviewByReviewer";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "address";
        readonly name: "reviewer";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "reviewer";
        }, {
            readonly type: "uint256";
            readonly name: "agentTokenId";
        }, {
            readonly type: "uint8";
            readonly name: "score";
        }, {
            readonly type: "string";
            readonly name: "comment";
        }, {
            readonly type: "uint256";
            readonly name: "timestamp";
        }, {
            readonly type: "bool";
            readonly name: "exists";
        }];
    }];
}, {
    readonly name: "hasReviewed";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
    }, {
        readonly type: "address";
        readonly name: "reviewer";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "FeedbackSubmitted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "reviewer";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "score";
    }, {
        readonly type: "string";
        readonly name: "comment";
    }];
}, {
    readonly name: "FeedbackUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "agentTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "reviewer";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "oldScore";
    }, {
        readonly type: "uint8";
        readonly name: "newScore";
    }, {
        readonly type: "string";
        readonly name: "comment";
    }];
}];
export declare const LINK_EIP712_TYPES: {
    readonly LinkAgent: readonly [{
        readonly name: "agentTokenId";
        readonly type: "uint256";
    }, {
        readonly name: "ethosProfileId";
        readonly type: "uint256";
    }, {
        readonly name: "role";
        readonly type: "uint8";
    }, {
        readonly name: "expiration";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }, {
        readonly name: "deadline";
        readonly type: "uint256";
    }];
};
/**
 * Build the EIP-712 domain for a given chain and registry address.
 */
export declare function buildEIP712Domain(chainId: number, linkRegistry: string): {
    name: "AgentHumanLinkRegistry";
    version: "1";
    chainId: number;
    verifyingContract: `0x${string}`;
};
//# sourceMappingURL=constants.d.ts.map