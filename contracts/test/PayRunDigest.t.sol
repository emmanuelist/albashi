// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PayRun} from "../src/PayRun.sol";

/// @notice The agent (apps/agent/src/payslip.ts) and the contract must hash a payslip identically, or every real
/// run fails with NotSigned. Same payslip, contract address and chain as apps/agent/test/vector.ts.
contract PayRunDigestTest is Test {
    address constant VECTOR_PAYRUN = 0x00000000000000000000000000000000000A1ba5;
    bytes32 constant AGENT_DIGEST = 0x7a7f9980f94ebff2791fbdf0262b03dc732a3bf122acded81f559f928bc57efd;

    function test_contractDigestMatchesTheAgents() public {
        vm.chainId(42220);
        deployCodeTo(
            "PayRun.sol:PayRun", abi.encode(address(0xA), address(0xB), address(0xC), address(0xD)), VECTOR_PAYRUN
        );
        PayRun.Line[] memory lines = new PayRun.Line[](2);
        lines[0] = PayRun.Line(0x2222222222222222222222222222222222222222, 600_000_000);
        lines[1] = PayRun.Line(0x3333333333333333333333333333333333333333, 800_000_000);
        PayRun.Payslip memory p = PayRun.Payslip({
            owner: 0x1111111111111111111111111111111111111111,
            lines: lines,
            maxUsdtIn: 2_000_000,
            minRate: 1_430_000_000,
            deadline: 1_800_000_000,
            salt: 0x6e6f762d70617900000000000000000000000000000000000000000000000000
        });
        assertEq(PayRun(VECTOR_PAYRUN).hashPayslip(p), AGENT_DIGEST);
    }
}
