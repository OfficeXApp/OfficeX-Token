// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Manual bridging vault for onchain accounting proofs (NOT TRUSTLESS AUTOMATED)
// currently we have the ancient_token with 1% burn which we want to migrate to token with 1% tax for project sustainabilty reasons
// we also want to bridge to Solana and other arbitrary chains with 1% tax there as well
// instead of a fully automated trustless bridge, we use a centralized solution for now with onchain accounting proofs
// we accept the centralized trust for now, but we plan to move to a trustless automated bridge in the future

// how it works
/**
 * 1. Holders wrap ancient_token on BaseL2 to receive token on BaseL2. the ancient_token gets stuck inside the vault forever
 * 2. Holders can choose to bridge token from BaseL2 to other chains such as Solana, via depositToBridgeOut, which admin manually processes by sending them the tokens on destination chain (the lock & finalization is for accounting)
 * 3. Holders can bridge back from Solana/etc to BaseL2 via depositToBridgeIn, which admin manually processes via finalizeBridgeIn which releases tokens to BaseL2 (on Solana it would look like holder sending tokens to admin with destination address as memo proof, matching the depositToBridgeIn receivingWalletAddress)
 * 4. There should always be BaseL2 token inventory for bidirectional bridging, while tokens on other chains are not in a vault, just manually processed by admin
 */
contract BridgeVault is Ownable, ReentrancyGuard {

    string public constant BRIDGE_NAME = "WRAPPED_BASE_BRIDGE_OFFICEX";
    
    IERC20 public immutable token;
    IERC20 public immutable ancient_token;

    address public feeTreasury;
    
    uint256 public constant BRIDGE_FEE = 0.002 ether;
    
    uint256 public depositOutCounter;
    uint256 public depositInCounter;
    
    // === TOTAL ACCOUNTING (Historical) ===
    uint256 public totalBridgeDeposited;        // All-time bridge deposits
    uint256 public totalBridgedOut;             // All-time tokens sent to other chains
    uint256 public totalBridgedIn;              // All-time tokens received from other chains
    uint256 public totalAncientWrapped;         // All-time ancient tokens wrapped to new tokens
    uint256 public totalWrappedRedeemed;        // All-time wrapped tokens redeemed back to ancient
    
    // === NET ACCOUNTING (Current State) ===
    uint256 public netBridgeDeposited;          // Current pending bridge deposits
    uint256 public netBridgedOut;               // Net tokens currently on other chains
    uint256 public netAncientLocked;            // Net ancient tokens locked in contract
    
    enum DepositStatus {
        Awaiting,   // 0
        Canceled,   // 1
        Locked,     // 2
        Finalized   // 3
    }
    
    enum DepositInStatus {
        Awaiting,   // 0
        Finalized   // 1
    }
    
    struct ProofDepositOut {
        uint256 depositOutId; 
        address depositor;
        uint256 amount;
        string receivingWalletAddress;
        string chain;
        DepositStatus status;
        string txRelease;
    }
    
    struct ProofDepositIn {
        uint256 depositInId;
        address depositor;
        uint256 amount;
        address receivingWalletAddress;
        string chain;
        DepositInStatus status;
        string txDepositProof; 
    }
    
    mapping(uint256 => ProofDepositOut) public depositsOut;
    mapping(uint256 => ProofDepositIn) public depositsIn;
    
    event DepositOutRequested(
        address indexed depositor,
        uint256 indexed depositOutId,
        uint256 amount,
        string receivingWalletAddress,
        string chain,
        DepositStatus status
    );
    
    event DepositInRequested(
        address indexed depositor,
        uint256 indexed depositInId,
        uint256 amount,
        address receivingWalletAddress, 
        string chain,
        DepositInStatus status
    );
    
    event CancelDepositOut(
        address indexed depositor,
        uint256 indexed depositOutId,
        uint256 amount
    );
    
    event LockDepositOut(
        uint256 indexed depositOutId,
        uint256 amount,
        bool isLocked
    );
    
    event BridgeOutFinalized(
        uint256 indexed depositOutId,
        uint256 amount,
        string txHash
    );
    
    event BridgeInFinalized(
        uint256 indexed depositInId,
        address indexed depositor,
        uint256 amount,
        string txDepositProof
    );
    
    event AncientTokenWrapped(
        address indexed user,
        uint256 ancientAmount,
        uint256 tokenAmount
    );

    event AncientTokenUnwrapped(
        address indexed user,
        uint256 tokenAmount,
        uint256 ancientAmount
    );

    // Enhanced comprehensive accounting event
    event AccountingUpdate(
        uint256 totalBridgeDeposited,
        uint256 totalBridgedOut,
        uint256 totalBridgedIn,
        uint256 totalAncientWrapped,
        uint256 totalWrappedRedeemed,
        uint256 netBridgeDeposited,
        uint256 netBridgedOut,
        uint256 netAncientLocked,
        uint256 availableInventory
    );
    
    constructor(
        address tokenAddress, 
        address ancientTokenAddress, 
        address adminAddress,
        address _feeTreasury
    ) Ownable(adminAddress) {
        require(tokenAddress != address(0), "Invalid token address");
        require(ancientTokenAddress != address(0), "Invalid ancient token address");
        require(_feeTreasury != address(0), "Invalid fee recipient address");
        token = IERC20(tokenAddress);
        ancient_token = IERC20(ancientTokenAddress);
        feeTreasury = _feeTreasury;
    }
    
    function depositToBridgeOut(
        uint256 tokenAmount,
        string calldata receivingWalletAddress,
        string calldata chain
    ) external payable nonReentrant {
        require(msg.value == BRIDGE_FEE, "Incorrect bridge fee");
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(bytes(receivingWalletAddress).length > 0, "Receiving wallet address required");
        require(bytes(chain).length > 0, "Chain required");
        
        // Check inventory using net accounting
        require(getAvailableBridgeInventory() >= tokenAmount, "Insufficient bridge inventory");
        
        // Transfer bridge fee to fee recipient
        (bool success, ) = feeTreasury.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        // Transfer tokens from user to this contract
        require(
            token.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );
        
        // Create deposit record
        depositsOut[depositOutCounter] = ProofDepositOut({
            depositOutId: depositOutCounter,
            depositor: msg.sender,
            amount: tokenAmount,
            receivingWalletAddress: receivingWalletAddress,
            chain: chain,
            status: DepositStatus.Awaiting,
            txRelease: ""
        });
        
        // Update BOTH total and net accounting
        totalBridgeDeposited += tokenAmount;         // Historical tracking
        netBridgeDeposited += tokenAmount;           // Current pending
        
        emit DepositOutRequested(
            msg.sender,
            depositOutCounter,
            tokenAmount,
            receivingWalletAddress,
            chain,
            DepositStatus.Awaiting
        );

        // Emit accounting update
        _emitAccountingUpdate();
        
        depositOutCounter++;
    }
    
    function depositToBridgeIn(
        uint256 tokenAmount,
        address receivingWalletAddress,
        string calldata chain,
        string calldata txDepositProof  // NEW: Required proof of deposit on source chain
    ) external payable nonReentrant {
        require(msg.value == BRIDGE_FEE, "Incorrect bridge fee");
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(receivingWalletAddress != address(0), "Receiving wallet address required");
        require(bytes(chain).length > 0, "Chain required");
        require(bytes(txDepositProof).length > 0, "Deposit proof required");
        
        // Transfer bridge fee to fee recipient
        (bool success, ) = feeTreasury.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        // Create deposit in record with txDepositProof
        depositsIn[depositInCounter] = ProofDepositIn({
            depositInId: depositInCounter,
            depositor: msg.sender,
            amount: tokenAmount,
            receivingWalletAddress: receivingWalletAddress,
            chain: chain,
            status: DepositInStatus.Awaiting,
            txDepositProof: txDepositProof  // Set immediately
        });
        
        // Emit event
        emit DepositInRequested(
            msg.sender,
            depositInCounter,
            tokenAmount,
            receivingWalletAddress,
            chain,
            DepositInStatus.Awaiting
        );
        
        depositInCounter++;
    }
    
    function cancelBridge(uint256 depositOutId) external nonReentrant {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        require(dep.depositor == msg.sender, "Only depositor can cancel");
        require(dep.status == DepositStatus.Awaiting, "Can only cancel awaiting deposits");
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= dep.amount, "Insufficient contract balance");
        
        // Ensure we don't underflow for both accounting systems
        require(totalBridgeDeposited >= dep.amount, "Total accounting underflow protection");
        require(netBridgeDeposited >= dep.amount, "Net accounting underflow protection");
        
        // Update deposit status
        dep.status = DepositStatus.Canceled;
        
        // Update BOTH total and net accounting
        totalBridgeDeposited -= dep.amount;          // Historical (this effectively becomes "net deposited that wasn't canceled")
        netBridgeDeposited -= dep.amount;            // Current pending
        
        // Transfer tokens back to depositor
        require(
            token.transfer(msg.sender, dep.amount),
            "Token transfer failed"
        );
        
        emit CancelDepositOut(msg.sender, depositOutId, dep.amount);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }
    
    function lockDeposit(uint256 depositOutId, bool lock) external onlyOwner {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        
        if (lock) {
            require(dep.status == DepositStatus.Awaiting, "Can only lock awaiting deposits");
            dep.status = DepositStatus.Locked;
        } else {
            require(dep.status == DepositStatus.Locked, "Can only unlock locked deposits");
            dep.status = DepositStatus.Awaiting;
        }
        
        // Emit event with lock status
        emit LockDepositOut(depositOutId, dep.amount, lock);
    }
    
    function finalizeBridgeOut(uint256 depositOutId, string calldata txHash) external onlyOwner {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        require(bytes(txHash).length > 0, "Transaction hash required");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        require(dep.status == DepositStatus.Locked, "Can only finalize locked deposits");
        
        uint256 finalizeAmount = dep.amount;
        
        // Verify contract has sufficient balance (tokens stay in vault)
        require(token.balanceOf(address(this)) >= finalizeAmount, "Insufficient contract balance");
        
        // Ensure we don't underflow
        require(totalBridgeDeposited >= finalizeAmount, "Total accounting underflow protection");
        require(netBridgeDeposited >= finalizeAmount, "Net accounting underflow protection");
        
        // Update BOTH total and net accounting
        totalBridgedOut += finalizeAmount;           // Historical tracking
        totalBridgeDeposited -= finalizeAmount;      // Remove from pending (historical)
        
        netBridgedOut += finalizeAmount;             // Increase net tokens on other chains
        netBridgeDeposited -= finalizeAmount;        // Remove from pending (current)
        
        // Update deposit status and set txRelease
        dep.status = DepositStatus.Finalized;
        dep.txRelease = txHash;
        
        // Emit event
        emit BridgeOutFinalized(depositOutId, finalizeAmount, txHash);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }
    
    function finalizeBridgeIn(uint256 depositInId) external onlyOwner nonReentrant {
        require(depositInId < depositInCounter, "Invalid deposit in ID");
        
        ProofDepositIn storage depIn = depositsIn[depositInId];
        require(depIn.status == DepositInStatus.Awaiting, "Can only finalize awaiting deposits");
        require(depIn.amount > 0, "Invalid deposit amount");
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= depIn.amount, "Insufficient contract balance");
        
        // CRITICAL FIX: Only check if we have tokens bridged out to bring back
        // If netBridgedOut is 0, we can't bridge anything back!
        require(netBridgedOut >= depIn.amount, "Insufficient tokens on other chains to bridge back");
        
        // Update deposit in record
        depIn.status = DepositInStatus.Finalized;
        
        // Update BOTH total and net accounting
        totalBridgedIn += depIn.amount;              // Historical tracking
        netBridgedOut -= depIn.amount;               // Decrease net tokens on other chains
        
        // Transfer tokens from vault to the receiving address (not depositor)
        require(
            token.transfer(depIn.receivingWalletAddress, depIn.amount),
            "Token transfer failed"
        );
        
        emit BridgeInFinalized(
            depositInId,
            depIn.depositor,
            depIn.amount,
            depIn.txDepositProof
        );
        
        // Emit accounting update
        _emitAccountingUpdate();
    }
    
    function wrapAncientForToken(uint256 ancientAmount) external nonReentrant {
        require(ancientAmount > 0, "Amount must be greater than zero");
        
        // Transfer ancient tokens from user to this contract
        require(
            ancient_token.transferFrom(msg.sender, address(this), ancientAmount),
            "Ancient token transfer failed"
        );
        
        // Verify contract has sufficient new token balance
        require(token.balanceOf(address(this)) >= ancientAmount, "Insufficient token balance");
        
        // Update BOTH total and net accounting for wrapping
        totalAncientWrapped += ancientAmount;        // Historical wrapping
        netAncientLocked += ancientAmount;           // Current ancient tokens locked
        
        // Transfer new tokens to user
        require(
            token.transfer(msg.sender, ancientAmount),
            "Token transfer failed"
        );
        
        // Emit event
        emit AncientTokenWrapped(msg.sender, ancientAmount, ancientAmount);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }
    
    // NEW: Allow unwrapping tokens back to ancient tokens
    function unwrapTokenForAncient(uint256 tokenAmount) external nonReentrant {
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(tokenAmount <= netAncientLocked, "Insufficient ancient tokens available");
        
        // Verify contract has sufficient ancient token balance
        require(ancient_token.balanceOf(address(this)) >= tokenAmount, "Insufficient ancient token balance");
        
        // Transfer new tokens from user to contract
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");
        
        // Transfer ancient tokens from contract to user
        require(ancient_token.transfer(msg.sender, tokenAmount), "Ancient token transfer failed");
        
        // Update BOTH total and net accounting
        totalWrappedRedeemed += tokenAmount;         // Historical tracking
        netAncientLocked -= tokenAmount;             // Reduce locked ancient tokens
        
        emit AncientTokenUnwrapped(msg.sender, tokenAmount, tokenAmount);
        _emitAccountingUpdate();
    }
    
    function setfeeTreasury(address newfeeTreasury) external onlyOwner {
        require(newfeeTreasury != address(0), "Invalid fee recipient address");
        feeTreasury = newfeeTreasury;
    }
    
    function changeAdmin(address newAdminAddr) external onlyOwner {
        _transferOwnership(newAdminAddr);
    }
    
    // Internal function to emit comprehensive accounting updates
    function _emitAccountingUpdate() internal {
        emit AccountingUpdate(
            totalBridgeDeposited,
            totalBridgedOut,
            totalBridgedIn,
            totalAncientWrapped,
            totalWrappedRedeemed,
            netBridgeDeposited,
            netBridgedOut,
            netAncientLocked,
            getAvailableBridgeInventory()
        );
    }
    
    // View functions for better transparency
    function getDepositOut(uint256 depositOutId) external view returns (ProofDepositOut memory) {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        return depositsOut[depositOutId];
    }
    
    function getDepositIn(uint256 depositInId) external view returns (ProofDepositIn memory) {
        require(depositInId < depositInCounter, "Invalid deposit in ID");
        return depositsIn[depositInId];
    }
    
    function getContractBalances() external view returns (uint256 tokenBalance, uint256 ancientTokenBalance) {
        return (token.balanceOf(address(this)), ancient_token.balanceOf(address(this)));
    }

    // Updated inventory calculation using net accounting
    function getAvailableBridgeInventory() public view returns (uint256) {
        uint256 contractBalance = token.balanceOf(address(this));
        
        // Available inventory = total balance - net pending bridge deposits
        return contractBalance >= netBridgeDeposited ? contractBalance - netBridgeDeposited : 0;
    }

    // Net tokens currently on other chains
    function getNetTokensOnOtherChains() public view returns (uint256) {
        return netBridgedOut;
    }
    
    // Total volume processed through the bridge
    function getTotalVolumeProcessed() public view returns (uint256) {
        return totalBridgedOut + totalBridgedIn + totalAncientWrapped + totalWrappedRedeemed;
    }
    
    // LEGACY: Keep original function for backwards compatibility but mark as deprecated
    function getAccountingInfo() external view returns (
        uint256 bridgeDeposited,
        uint256 bridgedOut,
        uint256 bridgedIn,
        uint256 ancientWrapped,
        uint256 availableInventory,
        uint256 totalTokenBalance,
        uint256 totalAncientBalance
    ) {
        return (
            totalBridgeDeposited,
            totalBridgedOut,
            totalBridgedIn,
            totalAncientWrapped,
            getAvailableBridgeInventory(),
            token.balanceOf(address(this)),
            ancient_token.balanceOf(address(this))
        );
    }

    // NEW: Comprehensive accounting information with both total and net
    function getFullAccountingInfo() external view returns (
        // Historical totals
        uint256 totalBridgeDeposited_,
        uint256 totalBridgedOut_,
        uint256 totalBridgedIn_,
        uint256 totalAncientWrapped_,
        uint256 totalWrappedRedeemed_,
        // Current net positions
        uint256 netBridgeDeposited_,
        uint256 netBridgedOut_,
        uint256 netAncientLocked_,
        // Contract balances
        uint256 tokenBalance,
        uint256 ancientBalance,
        // Derived metrics
        uint256 availableInventory,
        uint256 totalVolumeProcessed
    ) {
        return (
            totalBridgeDeposited,
            totalBridgedOut,
            totalBridgedIn,
            totalAncientWrapped,
            totalWrappedRedeemed,
            netBridgeDeposited,
            netBridgedOut,
            netAncientLocked,
            token.balanceOf(address(this)),
            ancient_token.balanceOf(address(this)),
            getAvailableBridgeInventory(),
            getTotalVolumeProcessed()
        );
    }

    // Enhanced integrity checks for both accounting systems
    function verifyAccountingIntegrity() external view returns (bool isValid, string memory error) {
        uint256 contractTokenBalance = token.balanceOf(address(this));
        uint256 contractAncientBalance = ancient_token.balanceOf(address(this));
        
        // Check 1: Net bridged out should match total difference
        if (netBridgedOut != (totalBridgedOut - totalBridgedIn)) {
            return (false, "Net bridged out calculation mismatch");
        }
        
        // Check 2: Contract should have enough tokens for pending deposits
        if (contractTokenBalance < netBridgeDeposited) {
            return (false, "Insufficient token balance for pending bridge deposits");
        }
        
        // Check 3: Ancient token balance should match net locked amount
        if (contractAncientBalance != netAncientLocked) {
            return (false, "Ancient token balance mismatch with net locked");
        }
        
        // Check 4: Available inventory should be consistent
        if (getAvailableBridgeInventory() > contractTokenBalance) {
            return (false, "Available inventory exceeds contract balance");
        }
        
        // Check 5: Net ancient locked should not exceed total wrapped
        if (netAncientLocked > totalAncientWrapped) {
            return (false, "Net ancient locked exceeds total wrapped");
        }
        
        // Check 6: Total wrapped redeemed should not exceed total wrapped
        if (totalWrappedRedeemed > totalAncientWrapped) {
            return (false, "Total wrapped redeemed exceeds total wrapped");
        }
        
        // Check 7: Net ancient locked should equal total wrapped minus total redeemed
        if (netAncientLocked != (totalAncientWrapped - totalWrappedRedeemed)) {
            return (false, "Net ancient locked calculation mismatch");
        }
        
        return (true, "Full accounting integrity verified");
    }
}