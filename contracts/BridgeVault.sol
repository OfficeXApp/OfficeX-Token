// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BridgeVault is Ownable, ReentrancyGuard {
    
    IERC20 public immutable token;
    
    uint256 public depositCounter;
    uint256 public totalNetDeposited;
    uint256 public totalNetBurnt;
    
    enum DepositStatus {
        Awaiting,   // 0
        Canceled,   // 1
        Locked,     // 2
        Burnt       // 3
    }
    
    struct Deposit {
        uint256 depositId; 
        address depositor;
        uint256 amount;
        string receivingWalletAddress;
        DepositStatus status;
        string txFinal;
    }
    
    mapping(uint256 => Deposit) public deposits;
    
    event DepositMade(
        address indexed depositor,
        uint256 indexed depositId,
        uint256 amount,
        string receivingWalletAddress,
        DepositStatus status
    );
    
    event Cancel(
        address indexed depositor,
        uint256 indexed depositId,
        uint256 amount
    );
    
    event Lock(
        uint256 indexed depositId,
        uint256 amount,
        bool isLocked
    );
    
    event Burn(
        uint256 indexed depositId,
        uint256 amount,
        string txHash
    );
    
    constructor(address tokenAddress, address adminAddress) Ownable(adminAddress) {
        require(tokenAddress != address(0), "Invalid token address");
        token = IERC20(tokenAddress);
    }
    
    function depositToBridge(
        uint256 tokenAmount,
        string calldata receivingWalletAddress
    ) external nonReentrant {
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(bytes(receivingWalletAddress).length > 0, "Receiving wallet address required");
        
        // Transfer tokens from user to this contract
        require(
            token.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );
        
        // Create deposit record
        deposits[depositCounter] = Deposit({
            depositId: depositCounter,
            depositor: msg.sender,
            amount: tokenAmount,
            receivingWalletAddress: receivingWalletAddress,
            status: DepositStatus.Awaiting,
            txFinal: ""
        });
        
        // Update accounting
        totalNetDeposited += tokenAmount;
        
        // Emit event
        emit DepositMade(
            msg.sender,
            depositCounter,
            tokenAmount,
            receivingWalletAddress,
            DepositStatus.Awaiting
        );
        
        depositCounter++;
    }
    
    function cancelBridge(uint256 depositId) external nonReentrant {
        require(depositId < depositCounter, "Invalid deposit ID");
        
        Deposit storage dep = deposits[depositId];
        require(dep.depositor == msg.sender, "Only depositor can cancel");
        require(dep.status == DepositStatus.Awaiting, "Can only cancel awaiting deposits");
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= dep.amount, "Insufficient contract balance");
        
        // Update deposit status
        dep.status = DepositStatus.Canceled;
        
        // Update accounting
        totalNetDeposited -= dep.amount;
        
        // Transfer tokens back to depositor
        require(
            token.transfer(msg.sender, dep.amount),
            "Token transfer failed"
        );
        
        // Emit event
        emit Cancel(msg.sender, depositId, dep.amount);
    }
    
    function lockDeposit(uint256 depositId, bool lock) external onlyOwner {
        require(depositId < depositCounter, "Invalid deposit ID");
        
        Deposit storage dep = deposits[depositId];
        
        if (lock) {
            require(dep.status == DepositStatus.Awaiting, "Can only lock awaiting deposits");
            dep.status = DepositStatus.Locked;
        } else {
            require(dep.status == DepositStatus.Locked, "Can only unlock locked deposits");
            dep.status = DepositStatus.Awaiting;
        }
        
        // Emit event with lock status
        emit Lock(depositId, dep.amount, lock);
    }
    
    function burnDeposit(uint256 depositId, string calldata txHash) external onlyOwner {
        require(depositId < depositCounter, "Invalid deposit ID");
        require(bytes(txHash).length > 0, "Transaction hash required");
        
        Deposit storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Locked, "Can only burn locked deposits");
        
        uint256 burnAmount = dep.amount;
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= burnAmount, "Insufficient contract balance");
        
        
        // Burn tokens by sending to dead address
        require(
            token.transfer(0x000000000000000000000000000000000000dEaD, burnAmount),
            "Token burn failed"
        );
        

        // Update accounting
        totalNetBurnt += burnAmount;
        
        // Update deposit status and set txFinal
        dep.status = DepositStatus.Burnt;
        dep.txFinal = txHash;
        
        // Emit event
        emit Burn(depositId, burnAmount, txHash);
    }
    
    function changeAdmin(address newAdminAddr) external onlyOwner {
        _transferOwnership(newAdminAddr);
    }
}