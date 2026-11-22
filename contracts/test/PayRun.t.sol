// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {PayRun} from "../src/PayRun.sol";
import {Token6, FillerReactor, SignedOrder, Wallet1271} from "./Doubles.sol";

contract PayRunTest is Test {
    Token6 usdt;
    Token6 cngn;
    FillerReactor reactor;
    PayRun payRun;

    uint256 ownerPk = 0xA11CE;
    address owner;
    uint256 takerPk = 0x7A4E5;
    address maker = makeAddr("maker");
    address amaka = makeAddr("amaka");
    address tunde = makeAddr("tunde");
    address stranger = makeAddr("stranger");

    // 1 USD₮ buys 1,440.57 cNGN; the owner accepts no less than 1,430.
    uint256 constant USDT_IN = 1e6;
    uint256 constant CNGN_OUT = 1_440_570_000;
    uint256 constant FLOOR = 1_430_000_000;

    function setUp() public {
        owner = vm.addr(ownerPk);
        usdt = new Token6("USDT");
        cngn = new Token6("cNGN");
        reactor = new FillerReactor(IERC20(address(usdt)), IERC20(address(cngn)));
        payRun = new PayRun(IERC20(address(usdt)), IERC20(address(cngn)), address(reactor), vm.addr(takerPk));

        usdt.mint(owner, 100e6);
        vm.prank(owner);
        usdt.approve(address(payRun), type(uint256).max);

        cngn.mint(maker, 1_000_000e6);
        vm.prank(maker);
        cngn.approve(address(reactor), type(uint256).max);
    }

    // ---- helpers

    function _lines(uint256 a, uint256 b) internal view returns (PayRun.Line[] memory lines) {
        lines = new PayRun.Line[](2);
        lines[0] = PayRun.Line(amaka, a);
        lines[1] = PayRun.Line(tunde, b);
    }

    function _payslip(PayRun.Line[] memory lines) internal view returns (PayRun.Payslip memory) {
        return PayRun.Payslip({
            owner: owner,
            lines: lines,
            maxUsdtIn: 2e6,
            minRate: FLOOR,
            deadline: uint64(block.timestamp + 1 hours),
            salt: keccak256("nov-pay")
        });
    }

    function _sign(uint256 pk, PayRun.Payslip memory p) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, payRun.hashPayslip(p));
        return abi.encodePacked(r, s, v);
    }

    function _swap(uint256 cngnOut, uint256 usdtIn) internal view returns (bytes memory) {
        SignedOrder[] memory orders = new SignedOrder[](1);
        orders[0] = SignedOrder(abi.encode(maker, cngnOut, usdtIn), hex"");
        return abi.encodeWithSelector(FillerReactor.executeBatch.selector, orders);
    }

    function _run(PayRun.Payslip memory p, bytes memory sig, uint256 usdtIn, bytes memory swapData)
        internal
        returns (uint256, uint256)
    {
        vm.prank(owner);
        return payRun.run(p, sig, usdtIn, swapData);
    }

    // ---- the signed payslip is paid exactly

    function test_paysExactlyTheSignedLines() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);

        (uint256 cngnReceived, uint256 usdtSpent) = _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));

        assertEq(cngnReceived, CNGN_OUT);
        assertEq(usdtSpent, USDT_IN);
        assertEq(cngn.balanceOf(amaka), 600e6);
        assertEq(cngn.balanceOf(tunde), 800e6);
        assertEq(cngn.balanceOf(owner), CNGN_OUT - 1400e6, "leftover cNGN back to the owner");
        assertEq(usdt.balanceOf(owner), 100e6 - USDT_IN);
        assertEq(usdt.balanceOf(maker), USDT_IN);
        assertEq(usdt.balanceOf(address(payRun)), 0, "holds no USDT after a run");
        assertEq(cngn.balanceOf(address(payRun)), 0, "holds no cNGN after a run");
        assertEq(usdt.allowance(address(payRun), address(reactor)), 0, "reactor allowance reset");
        assertTrue(payRun.used(payRun.hashPayslip(p)));
    }

    function test_unspentUsdtIsRefunded() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        // Pull 2 USD₮ but the quote only takes 1.
        _run(p, _sign(ownerPk, p), 2e6, _swap(CNGN_OUT, USDT_IN));
        assertEq(usdt.balanceOf(owner), 100e6 - USDT_IN);
        assertEq(usdt.balanceOf(address(payRun)), 0);
    }

    function test_executeEntryPointAlsoWorks() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory one = abi.encodeWithSelector(
            FillerReactor.execute.selector, SignedOrder(abi.encode(maker, CNGN_OUT, USDT_IN), hex"")
        );
        _run(p, _sign(ownerPk, p), USDT_IN, one);
        assertEq(cngn.balanceOf(tunde), 800e6);
    }

    // ---- a recipient not on the payslip

    function test_refuses_recipientNotOnThePayslip() public {
        PayRun.Payslip memory signed = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, signed);

        PayRun.Line[] memory lines = new PayRun.Line[](3);
        lines[0] = signed.lines[0];
        lines[1] = signed.lines[1];
        lines[2] = PayRun.Line(stranger, 10e6);
        PayRun.Payslip memory tampered = signed;
        tampered.lines = lines;

        vm.expectRevert(PayRun.NotSigned.selector);
        _run(tampered, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
        assertEq(cngn.balanceOf(stranger), 0);
    }

    function test_refuses_recipientSwapped() public {
        PayRun.Payslip memory signed = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, signed);
        PayRun.Payslip memory tampered = _payslip(_lines(600e6, 800e6));
        tampered.lines[1].to = stranger;

        vm.expectRevert(PayRun.NotSigned.selector);
        _run(tampered, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    // ---- an amount over the payslip

    function test_refuses_amountOverThePayslip() public {
        PayRun.Payslip memory signed = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, signed);
        PayRun.Payslip memory tampered = _payslip(_lines(600e6, 800e6 + 1));

        vm.expectRevert(PayRun.NotSigned.selector);
        _run(tampered, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    function test_refuses_moreUsdtThanTheBudget() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig1 = _sign(ownerPk, p);
        vm.expectRevert(abi.encodeWithSelector(PayRun.OverBudget.selector, 3e6, 2e6));
        _run(p, sig1, 3e6, _swap(CNGN_OUT, 3e6));
    }

    function test_refuses_signedBySomeoneElse() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig2 = _sign(0xBAD, p);
        vm.expectRevert(PayRun.NotSigned.selector);
        _run(p, sig2, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    // ---- a rate below the floor

    function test_refuses_rateBelowTheFloor() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        uint256 poor = 1_429_990_000; // a hair under the signed ₦1,430
        bytes memory sig3 = _sign(ownerPk, p);
        vm.expectRevert(abi.encodeWithSelector(PayRun.BelowFloor.selector, poor, USDT_IN, FLOOR));
        _run(p, sig3, USDT_IN, _swap(poor, USDT_IN));
        assertEq(usdt.balanceOf(owner), 100e6, "nothing moved");
    }

    function test_acceptsRateExactlyAtTheFloor() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        _run(p, _sign(ownerPk, p), USDT_IN, _swap(FLOOR, USDT_IN));
        assertEq(cngn.balanceOf(amaka), 600e6);
    }

    function test_refuses_shortfall() public {
        // Rate is fine, but the swap was too small to cover every line.
        PayRun.Payslip memory p = _payslip(_lines(600e6, 900e6));
        bytes memory sig4 = _sign(ownerPk, p);
        vm.expectRevert(abi.encodeWithSelector(PayRun.Shortfall.selector, CNGN_OUT, 1500e6));
        _run(p, sig4, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    // ---- expired, cancelled or replayed

    function test_refuses_expiredPayslip() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);
        vm.warp(p.deadline + 1);
        vm.expectRevert(PayRun.Expired.selector);
        _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    function test_refuses_replay() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);
        _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
        vm.expectRevert(PayRun.AlreadyUsed.selector);
        _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    function test_refuses_cancelledPayslip() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);
        vm.prank(owner);
        payRun.cancel(p);
        vm.expectRevert(PayRun.AlreadyUsed.selector);
        _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    function test_onlyTheOwnerCanCancel() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        vm.prank(stranger);
        vm.expectRevert(PayRun.NotOwner.selector);
        payRun.cancel(p);
    }

    // ---- who may run it, and what it may call

    function test_refuses_callerWhoIsNotTheOwner() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);
        vm.prank(stranger);
        vm.expectRevert(PayRun.NotOwner.selector);
        payRun.run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    function test_refuses_callThatIsNotAReactorFill() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory transferToStranger = abi.encodeWithSelector(IERC20.transfer.selector, stranger, 1e6);
        bytes memory sig5 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.NotAReactorFill.selector);
        _run(p, sig5, USDT_IN, transferToStranger);

        bytes memory sig6 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.NotAReactorFill.selector);
        _run(p, sig6, USDT_IN, hex"0d7a16");
    }

    function test_failedSwapRevertsEverything() public {
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);
        reactor.setBroken(true);
        vm.expectRevert();
        _run(p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN));
        assertEq(usdt.balanceOf(owner), 100e6);
        assertFalse(payRun.used(payRun.hashPayslip(p)), "a failed run leaves the payslip usable");
    }

    // ---- malformed payslips

    function test_refuses_emptyOrMalformedLines() public {
        PayRun.Payslip memory p = _payslip(new PayRun.Line[](0));
        bytes memory sig7 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.BadLines.selector);
        _run(p, sig7, USDT_IN, _swap(CNGN_OUT, USDT_IN));

        p = _payslip(_lines(0, 800e6));
        bytes memory sig8 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.BadLines.selector);
        _run(p, sig8, USDT_IN, _swap(CNGN_OUT, USDT_IN));

        PayRun.Line[] memory lines = _lines(600e6, 800e6);
        lines[0].to = address(0);
        p = _payslip(lines);
        bytes memory sig9 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.BadLines.selector);
        _run(p, sig9, USDT_IN, _swap(CNGN_OUT, USDT_IN));

        p = _payslip(new PayRun.Line[](101));
        bytes memory sig10 = _sign(ownerPk, p);
        vm.expectRevert(PayRun.BadLines.selector);
        _run(p, sig10, USDT_IN, _swap(CNGN_OUT, USDT_IN));
    }

    // ---- owners that are contracts or EIP-7702 accounts

    function test_contractWalletOwnerSignsThroughErc1271() public {
        Wallet1271 wallet = new Wallet1271(owner);
        usdt.mint(address(wallet), 10e6);
        vm.prank(owner);
        wallet.call(address(usdt), abi.encodeCall(IERC20.approve, (address(payRun), type(uint256).max)));

        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        p.owner = address(wallet);
        bytes memory sig = _sign(ownerPk, p);

        vm.prank(owner);
        wallet.call(address(payRun), abi.encodeCall(PayRun.run, (p, sig, USDT_IN, _swap(CNGN_OUT, USDT_IN))));
        assertEq(cngn.balanceOf(tunde), 800e6);
    }

    function test_eip7702AccountKeySignatureIsAccepted() public {
        // An EIP-7702 account is an EOA with code; its own key's signature must still count.
        vm.etch(owner, address(new Wallet1271(address(0xdead))).code);
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        _run(p, _sign(ownerPk, p), USDT_IN, _swap(CNGN_OUT, USDT_IN));
        assertEq(cngn.balanceOf(amaka), 600e6);
    }

    // ---- Textile's taker proof

    function test_isValidSignatureOnlyForTheTakerSigner() public {
        bytes32 h = keccak256("Textile Taker Control");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(takerPk, h);
        assertEq(payRun.isValidSignature(h, abi.encodePacked(r, s, v)), IERC1271.isValidSignature.selector);
        (v, r, s) = vm.sign(ownerPk, h);
        assertEq(payRun.isValidSignature(h, abi.encodePacked(r, s, v)), bytes4(0xffffffff));
        assertEq(payRun.isValidSignature(h, hex"1234"), bytes4(0xffffffff));
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(PayRun.ZeroAddress.selector);
        new PayRun(IERC20(address(0)), IERC20(address(cngn)), address(reactor), owner);
    }

    // ---- the floor holds for any quote

    function testFuzz_floorAndShortfallDecideTheOutcome(uint256 cngnOut, uint256 usdtIn) public {
        usdtIn = bound(usdtIn, 1, 2e6);
        cngnOut = bound(cngnOut, 0, 10_000e6);
        PayRun.Payslip memory p = _payslip(_lines(600e6, 800e6));
        bytes memory sig = _sign(ownerPk, p);

        bool floorOk = cngnOut * 1e6 >= FLOOR * usdtIn;
        bool enough = cngnOut >= 1400e6;
        if (!floorOk || !enough) vm.expectRevert();
        _run(p, sig, usdtIn, _swap(cngnOut, usdtIn));

        if (floorOk && enough) {
            assertEq(cngn.balanceOf(amaka) + cngn.balanceOf(tunde), 1400e6);
            assertEq(cngn.balanceOf(address(payRun)), 0);
            assertEq(usdt.balanceOf(address(payRun)), 0);
        } else {
            assertEq(cngn.balanceOf(amaka) + cngn.balanceOf(tunde), 0);
        }
    }
}
