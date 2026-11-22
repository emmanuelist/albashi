// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev A 6-decimal token, like USD₮ and cNGN on Celo.
contract Token6 is ERC20 {
    constructor(string memory name) ERC20(name, name) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Same order wrapper as Textile's LimitOrderReactor (UniswapX `SignedOrder`).
struct SignedOrder {
    bytes order;
    bytes sig;
}

/// @dev A test reactor with the filler semantics of Textile's verified LimitOrderReactor on Celo
/// (BaseReactor._prepare/_fill): the order's input is sent TO msg.sender (the filler), and each output is pulled
/// FROM msg.sender with transferFrom. Entry points have the real selectors: execute((bytes,bytes)) and
/// executeBatch((bytes,bytes)[]). Each order is abi.encode(maker, cngnOut, usdtIn): the maker gives `cngnOut` cNGN
/// and receives `usdtIn` USD₮.
contract FillerReactor {
    IERC20 public immutable USDT;
    IERC20 public immutable CNGN;
    bool public broken;

    constructor(IERC20 usdt, IERC20 cngn) {
        USDT = usdt;
        CNGN = cngn;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function execute(SignedOrder calldata order) external payable {
        _fill(order);
    }

    function executeBatch(SignedOrder[] calldata orders) external payable {
        for (uint256 i; i < orders.length; ++i) {
            _fill(orders[i]);
        }
    }

    function _fill(SignedOrder calldata o) internal {
        require(!broken, "quote expired");
        (address maker, uint256 cngnOut, uint256 usdtIn) = abi.decode(o.order, (address, uint256, uint256));
        require(CNGN.transferFrom(maker, msg.sender, cngnOut), "input");
        require(USDT.transferFrom(msg.sender, maker, usdtIn), "output");
    }
}

/// @dev A contract wallet that accepts its owner key's signatures through ERC-1271.
contract Wallet1271 is IERC1271 {
    address public immutable KEY;

    constructor(address key) {
        KEY = key;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == KEY ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }

    function call(address to, bytes calldata data) external returns (bytes memory) {
        require(msg.sender == KEY, "not key");
        (bool ok, bytes memory ret) = to.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }
}
