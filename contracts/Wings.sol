// SPDX-License-Identifier: MIT
pragma solidity 0.8.24; 

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Wings is ERC20, Ownable, ReentrancyGuard {

    address public adminAddress;
    address public treasuryAddress;
    
    uint256 public constant BURN_RATE_BPS = 100; // 1%
    uint256 public constant BASIS_POINTS = 10000;
    
    event FeesEarned(address indexed from, uint256 burnAmount);

    constructor(
        address _adminAddress,
        address _treasuryAddress
    ) ERC20("Wings", "WINGS") Ownable(_adminAddress) {
        require(_adminAddress != address(0), "Invalid address");

        adminAddress = _adminAddress;
        treasuryAddress = _treasuryAddress;
        
        _mint(_adminAddress, 210000000 * 10**18); // 210 million tokens
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override nonReentrant {
        require(amount > 0, "Transfer amount must be greater than zero");

        uint256 burnAmount = (amount * BURN_RATE_BPS) / BASIS_POINTS;
        uint256 transferAmount = amount - burnAmount;
        
        super._update(from, treasuryAddress, burnAmount);
        super._update(from, to, transferAmount);
        
        emit FeesEarned(from, burnAmount);
    }
}