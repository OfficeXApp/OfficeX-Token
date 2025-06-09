// SPDX-License-Identifier: MIT
pragma solidity 0.8.24; 

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; 

// github.com/OfficeXApp
// https://officex.app
contract OfficeX is ERC20, Ownable, ReentrancyGuard {
    
    mapping(address => bool) public allowlist;
    
    uint256 public constant BURN_RATE_BPS = 100; // 1%
    uint256 public constant BASIS_POINTS = 10000;
    
    event AddedToAllowlist(address indexed account);
    event RemovedFromAllowlist(address indexed account);
    event TokensBurned(address indexed from, uint256 burnAmount);

    constructor(
        address adminAddress
    ) ERC20("OfficeX", "OFFICEX") Ownable(adminAddress) {
        require(adminAddress != address(0), "Invalid address");
        
        allowlist[msg.sender] = true;
        allowlist[adminAddress] = true;
        
        _mint(adminAddress, 210000000 * 10**18); // 210 million tokens
    }


    function addToAllowlist(address account) external onlyOwner {
        require(account != address(0), "Invalid address");
        require(!allowlist[account], "Address already allowlisted");
        
        allowlist[account] = true;
        emit AddedToAllowlist(account);
    }

    function removeFromAllowlist(address account) external onlyOwner {
        require(allowlist[account], "Address not allowlisted");
        
        allowlist[account] = false;
        emit RemovedFromAllowlist(account);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override nonReentrant {
        require(amount > 0, "Transfer amount must be greater than zero");

        if (allowlist[from] || allowlist[to]) {
            super._update(from, to, amount);
        } else {
            uint256 burnAmount = (amount * BURN_RATE_BPS) / BASIS_POINTS;
            uint256 transferAmount = amount - burnAmount;
            
            super._update(from, address(0), burnAmount);
            super._update(from, to, transferAmount);
            
            emit TokensBurned(from, burnAmount);
        }
    }
}