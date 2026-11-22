// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

/// @title PayRun
/// @notice Pays a payroll in cNGN exactly as the owner signed it, and nothing else.
/// @dev The owner signs a payslip (EIP-712): who gets paid, how much cNGN each, the most USD₮ to spend, the
/// lowest cNGN-per-USD₮ rate accepted, and a deadline. The agent, acting from the owner's own wallet under a
/// session that may call only this contract, submits the payslip with a Textile FX quote. This contract pulls the
/// USD₮, fills the quote as the taker (cNGN arrives here), checks the rate it actually got against the signed floor,
/// pays each signed line, and returns everything left to the owner, in one transaction. There is no other way
/// for funds to leave: a line that was not signed fails the signature check, and the contract holds nothing between
/// runs.
contract PayRun is EIP712, ReentrancyGuardTransient, IERC1271 {
    using SafeERC20 for IERC20;

    /// @notice One payslip line: a recipient and the cNGN they receive, in base units (6 decimals).
    struct Line {
        address to;
        uint256 amount;
    }

    /// @notice What the owner signs.
    /// @param owner The paying wallet; it must be the caller and the signer.
    /// @param lines Recipients and cNGN amounts. Paid exactly, in order.
    /// @param maxUsdtIn The most USD₮ (base units, 6 decimals) this run may pull from the owner.
    /// @param minRate The lowest rate accepted: cNGN base units received per 1 USD₮ (1e6 base units) spent.
    /// @param deadline Unix seconds after which the payslip can't run.
    /// @param salt Any value that makes the payslip unique; each payslip runs at most once.
    struct Payslip {
        address owner;
        Line[] lines;
        uint256 maxUsdtIn;
        uint256 minRate;
        uint64 deadline;
        bytes32 salt;
    }

    bytes32 public constant LINE_TYPEHASH = keccak256("Line(address to,uint256 amount)");
    bytes32 public constant PAYSLIP_TYPEHASH = keccak256(
        "Payslip(address owner,Line[] lines,uint256 maxUsdtIn,uint256 minRate,uint64 deadline,bytes32 salt)"
        "Line(address to,uint256 amount)"
    );

    /// @notice Most lines one payslip may hold, so a run always fits in a block.
    uint256 public constant MAX_LINES = 100;

    uint256 internal constant USDT_UNIT = 1e6;
    /// @dev The reactor's two fill entry points: execute((bytes,bytes)) and executeBatch((bytes,bytes)[]).
    bytes4 internal constant EXECUTE = 0x3f62192e;
    bytes4 internal constant EXECUTE_BATCH = 0x0d7a16c3;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    IERC20 public immutable USDT;
    IERC20 public immutable CNGN;
    /// @notice Textile FX's LimitOrderReactor: the only contract a run may call to swap.
    address public immutable REACTOR;
    /// @notice The key whose signatures this contract accepts through ERC-1271, so that Textile can bind quotes to
    /// this contract as the taker. It authorises nothing on-chain: the contract never approves Permit2 and holds no
    /// funds between runs.
    address public immutable TAKER_SIGNER;

    /// @notice Payslips that have run or were cancelled, by EIP-712 digest.
    mapping(bytes32 digest => bool) public used;

    event Ran(
        bytes32 indexed digest,
        address indexed owner,
        uint256 usdtSpent,
        uint256 cngnReceived,
        uint256 cngnPaid,
        uint256 lines
    );
    event Paid(bytes32 indexed digest, uint256 indexed line, address indexed to, uint256 amount);
    event Cancelled(bytes32 indexed digest, address indexed owner);

    error NotOwner();
    error Expired();
    error AlreadyUsed();
    error NotSigned();
    error BadLines();
    error OverBudget(uint256 usdtIn, uint256 maxUsdtIn);
    error NotAReactorFill();
    error SwapFailed(bytes reason);
    error BelowFloor(uint256 cngnReceived, uint256 usdtSpent, uint256 minRate);
    error Shortfall(uint256 cngnReceived, uint256 cngnOwed);
    error ZeroAddress();

    constructor(IERC20 usdt, IERC20 cngn, address reactor, address takerSigner) EIP712("Albashi PayRun", "1") {
        if (
            address(usdt) == address(0) || address(cngn) == address(0) || reactor == address(0)
                || takerSigner == address(0)
        ) revert ZeroAddress();
        USDT = usdt;
        CNGN = cngn;
        REACTOR = reactor;
        TAKER_SIGNER = takerSigner;
    }

    /// @notice Runs a signed payslip: swap USD₮ for cNGN on Textile, check the rate, pay the signed lines, refund.
    /// @param p The payslip, exactly as signed.
    /// @param signature The owner's signature over the payslip's EIP-712 digest.
    /// @param usdtIn The USD₮ to pull for the swap (the quote's takerPays); at most `p.maxUsdtIn`.
    /// @param swapData Calldata for the reactor's execute or executeBatch, from Textile's firm quote.
    /// @return cngnReceived cNGN the swap delivered to this contract.
    /// @return usdtSpent USD₮ the swap consumed.
    function run(Payslip calldata p, bytes calldata signature, uint256 usdtIn, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 cngnReceived, uint256 usdtSpent)
    {
        (bytes32 digest, uint256 owed) = _check(p, signature, usdtIn, swapData);
        used[digest] = true;

        uint256 usdtLeft;
        (cngnReceived, usdtSpent, usdtLeft) = _swap(usdtIn, swapData);

        if (cngnReceived * USDT_UNIT < p.minRate * usdtSpent) {
            revert BelowFloor(cngnReceived, usdtSpent, p.minRate);
        }
        if (cngnReceived < owed) revert Shortfall(cngnReceived, owed);

        // Events follow the swap because they report what it actually delivered (nonReentrant run, immutable reactor, values measured from balances).
        // forge-lint: disable-next-line(reentrancy-events)
        emit Ran(digest, p.owner, usdtSpent, cngnReceived, owed, p.lines.length);
        _pay(digest, p.lines);
        if (cngnReceived > owed) CNGN.safeTransfer(p.owner, cngnReceived - owed);
        if (usdtLeft > 0) USDT.safeTransfer(p.owner, usdtLeft);
    }

    /// @notice The owner withdraws a signed payslip before it runs. Only the owner can cancel their own payslip.
    function cancel(Payslip calldata p) external {
        if (msg.sender != p.owner) revert NotOwner();
        bytes32 digest = hashPayslip(p);
        if (used[digest]) revert AlreadyUsed();
        used[digest] = true;
        // No external call precedes this: hashPayslip is called internally and only hashes (lint false positive).
        // forge-lint: disable-next-line(reentrancy-events)
        emit Cancelled(digest, p.owner);
    }

    /// @notice The EIP-712 digest the owner signs for a payslip.
    function hashPayslip(Payslip calldata p) public view returns (bytes32) {
        uint256 n = p.lines.length;
        bytes32[] memory lineHashes = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            lineHashes[i] = keccak256(abi.encode(LINE_TYPEHASH, p.lines[i].to, p.lines[i].amount));
        }
        bytes32 structHash = keccak256(
            abi.encode(
                PAYSLIP_TYPEHASH,
                p.owner,
                keccak256(abi.encodePacked(lineHashes)),
                p.maxUsdtIn,
                p.minRate,
                p.deadline,
                p.salt
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /// @notice ERC-1271, for Textile's taker proof only: valid when `TAKER_SIGNER` signed `hash`.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        return err == ECDSA.RecoverError.NoError && recovered == TAKER_SIGNER
            ? IERC1271.isValidSignature.selector
            : ERC1271_INVALID;
    }

    /// @dev Every check that needs no external call: caller, deadline, lines, single use, signature, budget, and
    /// that the swap is a fill on the reactor. Returns the digest and the cNGN owed across all lines.
    function _check(Payslip calldata p, bytes calldata signature, uint256 usdtIn, bytes calldata swapData)
        internal
        view
        returns (bytes32 digest, uint256 owed)
    {
        if (msg.sender != p.owner) revert NotOwner();
        // A payroll cut-off in seconds; a validator's few seconds of timestamp drift can't matter here.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > p.deadline) revert Expired();
        uint256 n = p.lines.length;
        if (n == 0 || n > MAX_LINES) revert BadLines();

        digest = hashPayslip(p);
        if (used[digest]) revert AlreadyUsed();
        if (!_signedByOwner(p.owner, digest, signature)) revert NotSigned();
        if (usdtIn == 0 || usdtIn > p.maxUsdtIn) revert OverBudget(usdtIn, p.maxUsdtIn);
        if (swapData.length < 4) revert NotAReactorFill();
        bytes4 selector = bytes4(swapData[:4]);
        if (selector != EXECUTE && selector != EXECUTE_BATCH) revert NotAReactorFill();

        for (uint256 i; i < n; ++i) {
            Line calldata line = p.lines[i];
            // A payslip with any bad line fails as a whole, before any money moves.
            // forge-lint: disable-next-line(require-revert-in-loop)
            if (line.to == address(0) || line.amount == 0) revert BadLines();
            owed += line.amount;
        }
    }

    /// @dev Pulls `usdtIn` from the caller, who `_check` proved is the owner, and fills the quote on the reactor as
    /// the taker. Measures what actually
    /// moved: the swap's own figures are never trusted.
    function _swap(uint256 usdtIn, bytes calldata swapData)
        internal
        returns (uint256 cngnReceived, uint256 usdtSpent, uint256 usdtLeft)
    {
        uint256 usdtBefore = USDT.balanceOf(address(this));
        uint256 cngnBefore = CNGN.balanceOf(address(this));

        USDT.safeTransferFrom(msg.sender, address(this), usdtIn);
        USDT.forceApprove(REACTOR, usdtIn);
        (bool ok, bytes memory reason) = REACTOR.call(swapData);
        if (!ok) revert SwapFailed(reason);
        USDT.forceApprove(REACTOR, 0);

        usdtLeft = USDT.balanceOf(address(this)) - usdtBefore;
        usdtSpent = usdtIn - usdtLeft;
        cngnReceived = CNGN.balanceOf(address(this)) - cngnBefore;
    }

    /// @dev Pays each signed line, in order.
    function _pay(bytes32 digest, Line[] calldata lines) internal {
        uint256 n = lines.length;
        for (uint256 i; i < n; ++i) {
            // forge-lint: disable-next-line(reentrancy-events)
            emit Paid(digest, i, lines[i].to, lines[i].amount);
            CNGN.safeTransfer(lines[i].to, lines[i].amount);
        }
    }

    /// @dev The owner's key signing directly is accepted first: an EIP-7702 account is an EOA with code, and its key
    /// controls it fully. A wallet that is a contract proves its signature through ERC-1271.
    function _signedByOwner(address owner, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == owner) return true;
        return owner.code.length > 0 && SignatureChecker.isValidERC1271SignatureNow(owner, digest, signature);
    }
}
