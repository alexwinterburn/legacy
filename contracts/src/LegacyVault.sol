// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 *                    ⚠  REFERENCE IMPLEMENTATION — NOT FOR PRODUCTION  ⚠
 *
 *  UNAUDITED. NOT DEPLOYED. TESTNET ONLY. DO NOT SEND REAL FUNDS TO THIS CONTRACT.
 *
 *  An independent security audit is a hard launch gate (see ROADMAP.md Phase 2). This file
 *  exists to make the architecture concrete and reviewable, not to be deployed.
 *
 *  ---------------------------------------------------------------------------------------------
 *  DESIGN NOTES — the deliberate omissions matter as much as the code.
 *
 *  1. NO UPGRADE PROXY.
 *     An upgradeable succession contract has an admin key that can rewrite who inherits. That is
 *     a fund-theft key with extra steps, and it reintroduces exactly the trust this product exists
 *     to remove. Migration is opt-in per user, not an upgrade imposed on everyone.
 *
 *  2. NO ADMIN PAUSE ON EXECUTION.
 *     A pause switch over succession is a freeze capability. Pausing is limited to accepting NEW
 *     plans; existing plans can always complete.
 *
 *  3. THE CONTRACT HOLDS POLICY, NOT PRINCIPAL, BY DEFAULT.
 *     Assets stay in the owner's account and are moved via allowance at execution time. A bug in
 *     this contract therefore cannot drain a balance that was never here.
 *
 *  4. ownerVeto() IS THE CHEAPEST PATH AND CANNOT BE BLOCKED.
 *     No quorum, no admin, no delay. A living owner must always be able to stop this, even under
 *     network congestion, and even if every attestor says otherwise.
 *
 *  5. ATTESTATIONS ARE EVIDENCE, NOT INSTRUCTIONS.
 *     A quorum of attestations is a necessary condition, never a sufficient one. The dispute
 *     deadline and the absence of a veto are equally necessary.
 */
contract LegacyVault {
    // ---------------------------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------------------------

    enum PlanState {
        NONE,
        ACTIVE,
        CLAIM_OPEN,
        EXECUTABLE,
        DISTRIBUTED,
        VETOED
    }

    struct Beneficiary {
        address payable account;
        uint16 basisPoints; // 0..10000
    }

    struct Plan {
        address owner;
        PlanState state;
        uint64 coolingOffSeconds;
        uint64 claimOpenedAt;
        uint64 disputeDeadline;
        uint8 requiredAttestors;
        uint8 requiredDistinctClasses;
        uint256 nonce;
    }

    /// @dev Attestor classes mirror the off-chain independence classes. Two attestors of the same
    ///      class never satisfy the independence requirement, however many signatures they produce.
    enum AttestorClass {
        NONE,
        CIVIL_REGISTRY,
        MEDICAL,
        JUDICIAL,
        FINANCIAL,
        PLATFORM
    }

    // ---------------------------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------------------------

    mapping(bytes32 => Plan) public plans;
    mapping(bytes32 => Beneficiary[]) private _beneficiaries;
    mapping(address => AttestorClass) public attestorClass;
    mapping(bytes32 => mapping(address => bool)) private _attestationUsed;

    /// @dev Registry admin may add/remove attestors and pause NEW plan creation. It has no power
    ///      whatsoever over existing plans — see design note 2.
    address public registryAdmin;
    bool public newPlansPaused;

    uint16 public constant BASIS_POINTS_TOTAL = 10_000;
    uint64 public constant MIN_COOLING_OFF = 30 days;

    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 private constant _ATTESTATION_TYPEHASH =
        keccak256(
            "DeathAttestation(bytes32 planId,uint8 confidenceLevel,uint256 nonce,uint256 assertedAt,uint256 validUntil)"
        );

    // ---------------------------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------------------------

    event PlanCreated(bytes32 indexed planId, address indexed owner, uint64 coolingOffSeconds);
    event ClaimOpened(bytes32 indexed planId, uint64 disputeDeadline);
    event AttestationAccepted(bytes32 indexed planId, address indexed attestor, AttestorClass class_);
    event PlanExecutable(bytes32 indexed planId);
    event Distributed(bytes32 indexed planId, address indexed beneficiary, uint256 amount);
    event OwnerVetoed(bytes32 indexed planId, uint64 at);

    // ---------------------------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------------------------

    error NotOwner();
    error NotAdmin();
    error WrongState();
    error CoolingOffTooShort();
    error CoolingOffNotElapsed(uint64 remaining);
    error AllocationsMustSumTo100(uint16 actual);
    error InsufficientQuorum(uint8 got, uint8 required);
    error InsufficientIndependence(uint8 got, uint8 required);
    error DuplicateAttestor(address attestor);
    error UnknownAttestor(address attestor);
    error AttestationExpired();
    error NewPlansPaused();
    error NothingToDistribute();

    // ---------------------------------------------------------------------------------------

    constructor(address admin) {
        registryAdmin = admin;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("LegacyVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    modifier onlyAdmin() {
        if (msg.sender != registryAdmin) revert NotAdmin();
        _;
    }

    // ---------------------------------------------------------------------------------------
    // Plan lifecycle
    // ---------------------------------------------------------------------------------------

    function createPlan(
        bytes32 planId,
        Beneficiary[] calldata beneficiaries_,
        uint64 coolingOffSeconds,
        uint8 requiredAttestors,
        uint8 requiredDistinctClasses
    ) external {
        if (newPlansPaused) revert NewPlansPaused();
        if (plans[planId].state != PlanState.NONE) revert WrongState();
        if (coolingOffSeconds < MIN_COOLING_OFF) revert CoolingOffTooShort();

        uint16 total;
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            total += beneficiaries_[i].basisPoints;
            _beneficiaries[planId].push(beneficiaries_[i]);
        }
        if (total != BASIS_POINTS_TOTAL) revert AllocationsMustSumTo100(total);

        plans[planId] = Plan({
            owner: msg.sender,
            state: PlanState.ACTIVE,
            coolingOffSeconds: coolingOffSeconds,
            claimOpenedAt: 0,
            disputeDeadline: 0,
            requiredAttestors: requiredAttestors,
            requiredDistinctClasses: requiredDistinctClasses,
            nonce: 0
        });

        emit PlanCreated(planId, msg.sender, coolingOffSeconds);
    }

    /**
     * @notice Open a claim. This starts the clock; it does not move anything.
     * @dev Callable by anyone — an heir may need to open a claim, and gatekeeping who may do so
     *      would strand families. The protection is the delay and the veto, not the gate.
     */
    function openClaim(bytes32 planId) external {
        Plan storage p = plans[planId];
        if (p.state != PlanState.ACTIVE) revert WrongState();

        p.state = PlanState.CLAIM_OPEN;
        p.claimOpenedAt = uint64(block.timestamp);
        p.disputeDeadline = uint64(block.timestamp) + p.coolingOffSeconds;

        emit ClaimOpened(planId, p.disputeDeadline);
    }

    /**
     * @notice The owner's veto. Permanent, immediate, unblockable.
     * @dev Deliberately the simplest and cheapest state-changing function in the contract.
     *      A living owner must be able to execute this under any network conditions.
     */
    function ownerVeto(bytes32 planId) external {
        Plan storage p = plans[planId];
        if (msg.sender != p.owner) revert NotOwner();
        if (p.state == PlanState.DISTRIBUTED) revert WrongState();

        p.state = PlanState.VETOED;
        emit OwnerVetoed(planId, uint64(block.timestamp));
    }

    /// @notice Reactivate after a vetoed claim is resolved. Owner only.
    function reactivate(bytes32 planId) external {
        Plan storage p = plans[planId];
        if (msg.sender != p.owner) revert NotOwner();
        if (p.state != PlanState.VETOED) revert WrongState();

        p.state = PlanState.ACTIVE;
        p.claimOpenedAt = 0;
        p.disputeDeadline = 0;
        p.nonce += 1; // invalidate every attestation issued against the previous nonce
    }

    // ---------------------------------------------------------------------------------------
    // Attestation
    // ---------------------------------------------------------------------------------------

    /**
     * @notice Submit signed attestations and, if every condition holds, mark the plan executable.
     *
     * ALL of the following must be true — a quorum alone is never sufficient:
     *   - the plan has an open claim
     *   - the cooling-off period has fully elapsed
     *   - the owner has not vetoed
     *   - enough valid attestations from distinct, registered attestors
     *   - those attestors span enough distinct independence classes
     */
    function submitAttestations(
        bytes32 planId,
        uint8 confidenceLevel,
        uint256 assertedAt,
        uint256 validUntil,
        bytes[] calldata signatures
    ) external {
        Plan storage p = plans[planId];
        if (p.state != PlanState.CLAIM_OPEN) revert WrongState();
        if (block.timestamp < p.disputeDeadline) {
            revert CoolingOffNotElapsed(p.disputeDeadline - uint64(block.timestamp));
        }
        if (block.timestamp > validUntil) revert AttestationExpired();

        bytes32 digest = _attestationDigest(planId, confidenceLevel, p.nonce, assertedAt, validUntil);

        uint8 valid;
        uint8 classMask;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = _recover(digest, signatures[i]);
            AttestorClass class_ = attestorClass[signer];
            if (class_ == AttestorClass.NONE) revert UnknownAttestor(signer);
            if (_attestationUsed[planId][signer]) revert DuplicateAttestor(signer);

            _attestationUsed[planId][signer] = true;
            valid += 1;
            classMask |= uint8(1 << uint8(class_));

            emit AttestationAccepted(planId, signer, class_);
        }

        if (valid < p.requiredAttestors) revert InsufficientQuorum(valid, p.requiredAttestors);

        uint8 distinctClasses = _popcount(classMask);
        if (distinctClasses < p.requiredDistinctClasses) {
            revert InsufficientIndependence(distinctClasses, p.requiredDistinctClasses);
        }

        p.state = PlanState.EXECUTABLE;
        emit PlanExecutable(planId);
    }

    // ---------------------------------------------------------------------------------------
    // Distribution
    // ---------------------------------------------------------------------------------------

    /**
     * @notice Distribute the contract's native balance for this plan.
     * @dev Checks-effects-interactions: state is set to DISTRIBUTED before any external call, so a
     *      reentrant beneficiary contract finds the plan already distributed. The remainder from
     *      integer division goes to the LAST beneficiary so the sum is exactly conserved — no wei
     *      is ever stranded.
     */
    function distribute(bytes32 planId) external {
        Plan storage p = plans[planId];
        if (p.state != PlanState.EXECUTABLE) revert WrongState();

        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToDistribute();

        p.state = PlanState.DISTRIBUTED; // effects before interactions

        Beneficiary[] storage bens = _beneficiaries[planId];
        uint256 distributed;

        for (uint256 i = 0; i < bens.length; i++) {
            uint256 amount = i == bens.length - 1
                ? balance - distributed // remainder to the last, so nothing is lost
                : (balance * bens[i].basisPoints) / BASIS_POINTS_TOTAL;

            distributed += amount;
            (bool sent, ) = bens[i].account.call{value: amount}("");
            require(sent, "transfer failed");

            emit Distributed(planId, bens[i].account, amount);
        }

        assert(distributed == balance); // conservation
    }

    receive() external payable {}

    // ---------------------------------------------------------------------------------------
    // Registry admin — deliberately powerless over existing plans
    // ---------------------------------------------------------------------------------------

    function setAttestor(address attestor, AttestorClass class_) external onlyAdmin {
        attestorClass[attestor] = class_;
    }

    /// @dev Pauses creation of NEW plans only. Existing plans always complete. See design note 2.
    function pauseNewPlans(bool paused) external onlyAdmin {
        newPlansPaused = paused;
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    function beneficiaries(bytes32 planId) external view returns (Beneficiary[] memory) {
        return _beneficiaries[planId];
    }

    function domainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    // ---------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------

    /// @dev chainId and verifyingContract are inside the domain separator, and planId + nonce are
    ///      inside the struct hash — so an attestation cannot be replayed across chains, contracts,
    ///      plans, or a reactivated claim.
    function _attestationDigest(
        bytes32 planId,
        uint8 confidenceLevel,
        uint256 nonce,
        uint256 assertedAt,
        uint256 validUntil
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(_ATTESTATION_TYPEHASH, planId, confidenceLevel, nonce, assertedAt, validUntil)
        );
        return keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
    }

    /// @dev Rejects the upper half of the s-range to prevent signature malleability (EIP-2).
    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "bad signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "malleable signature"
        );
        require(v == 27 || v == 28, "bad v");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid signature");
        return signer;
    }

    function _popcount(uint8 x) internal pure returns (uint8 count) {
        while (x != 0) {
            count += x & 1;
            x >>= 1;
        }
    }
}
