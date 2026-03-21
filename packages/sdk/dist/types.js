/**
 * ============================================================
 *  @agenttrust/sdk — Core Types
 * ============================================================
 *
 *  Shared types for the entire SDK. Maps directly to the
 *  AgentHumanLinkRegistry smart contract and ERC-8004.
 * ============================================================
 */
// ── Roles ────────────────────────────────────────────────────────
export var Role;
(function (Role) {
    Role[Role["Creator"] = 0] = "Creator";
    Role[Role["Operator"] = 1] = "Operator";
    Role[Role["Maintainer"] = 2] = "Maintainer";
    Role[Role["Delegate"] = 3] = "Delegate";
    Role[Role["Renter"] = 4] = "Renter";
})(Role || (Role = {}));
export const ROLE_NAMES = {
    [Role.Creator]: "creator",
    [Role.Operator]: "operator",
    [Role.Maintainer]: "maintainer",
    [Role.Delegate]: "delegate",
    [Role.Renter]: "renter",
};
export const ROLE_WEIGHTS = {
    [Role.Creator]: 1.0,
    [Role.Operator]: 0.8,
    [Role.Maintainer]: 0.5,
    [Role.Delegate]: 0.3,
    [Role.Renter]: 0.2,
};
// ── Verification Levels ──────────────────────────────────────────
export var VerificationLevel;
(function (VerificationLevel) {
    VerificationLevel[VerificationLevel["SelfClaim"] = 0] = "SelfClaim";
    VerificationLevel[VerificationLevel["AgentConfirmation"] = 1] = "AgentConfirmation";
    VerificationLevel[VerificationLevel["MutualVerification"] = 2] = "MutualVerification";
})(VerificationLevel || (VerificationLevel = {}));
export const VERIFICATION_NAMES = {
    [VerificationLevel.SelfClaim]: "self-claim",
    [VerificationLevel.AgentConfirmation]: "agent-confirmation",
    [VerificationLevel.MutualVerification]: "mutual-verification",
};
// ── Link Status ──────────────────────────────────────────────────
export var LinkStatus;
(function (LinkStatus) {
    LinkStatus[LinkStatus["Active"] = 0] = "Active";
    LinkStatus[LinkStatus["Revoked"] = 1] = "Revoked";
})(LinkStatus || (LinkStatus = {}));
//# sourceMappingURL=types.js.map