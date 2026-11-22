// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PayRun} from "../src/PayRun.sol";

/// @notice Checks PayRun's assumptions against Celo mainnet itself. Opt-in: CELO_FORK=1 forge test.
/// Addresses are the ones verified in docs/CONTEXT.md.
contract PayRunForkTest is Test {
    address constant USDT = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
    address constant CNGN = 0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f;
    address constant REACTOR = 0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3;

    function setUp() public {
        if (vm.envOr("CELO_FORK", uint256(0)) != 1) vm.skip(true);
        vm.createSelectFork(vm.envOr("CELO_RPC_URL", string("https://forno.celo.org")));
        assertEq(block.chainid, 42220, "Celo mainnet");
    }

    function test_tokensAreSixDecimals() public view {
        assertEq(IERC20Metadata(USDT).decimals(), 6, "USDT");
        assertEq(IERC20Metadata(CNGN).decimals(), 6, "cNGN");
    }

    function test_reactorExposesTheFillSelectorsRunAccepts() public view {
        bytes memory code = REACTOR.code;
        assertGt(code.length, 0, "reactor deployed");
        assertTrue(_hasPush4(code, 0x3f62192e), "execute((bytes,bytes))");
        assertTrue(_hasPush4(code, 0x0d7a16c3), "executeBatch((bytes,bytes)[])");
    }

    function test_deploysAgainstTheRealContracts() public {
        PayRun payRun = new PayRun(IERC20(USDT), IERC20(CNGN), REACTOR, makeAddr("agent"));
        assertEq(address(payRun.USDT()), USDT);
        assertEq(address(payRun.CNGN()), CNGN);
        assertEq(payRun.REACTOR(), REACTOR);
    }

    /// @dev Solidity dispatchers compare the calldata selector with PUSH4 <selector>.
    function _hasPush4(bytes memory code, bytes4 selector) internal pure returns (bool) {
        for (uint256 i; i + 4 < code.length; ++i) {
            if (
                code[i] == 0x63 && code[i + 1] == selector[0] && code[i + 2] == selector[1]
                    && code[i + 3] == selector[2] && code[i + 4] == selector[3]
            ) return true;
        }
        return false;
    }
}
