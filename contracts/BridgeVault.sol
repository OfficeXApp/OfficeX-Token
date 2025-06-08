// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    using SafeERC20 for IERC20;

    string public constant BRIDGE_NAME = "WRAPPED_BASE_BRIDGE_OFFICEX";
    
    IERC20 public immutable token;
    IERC20 public immutable ancient_token;
    bool public unwrapEnabled = true;

    address public feeTreasury;
    
    uint256 public constant BRIDGE_FEE = 0.002 ether;
    uint256 public constant MAX_BRIDGE_AMOUNT = 20 * 1000000 * 10**18; // 20M tokens max per transaction
    uint256 public constant MIN_BRIDGE_AMOUNT = 1 * 10**15; // 0.001 tokens minimum
    
    uint256 public depositOutCounter;
    uint256 public depositInCounter;
    uint256 public wrapOperationCounter;
    
    // === HISTORICAL ACCOUNTING (Immutable Totals) ===
    uint256 public totalBridgeDeposited;        // All-time bridge deposits (NEVER decreases)
    uint256 public totalBridgeCanceled;         // All-time bridge cancellations
    uint256 public totalBridgedOut;             // All-time tokens sent to other chains
    uint256 public totalBridgedIn;              // All-time tokens received from other chains
    uint256 public totalAncientWrapped;         // All-time ancient tokens wrapped to new tokens
    uint256 public totalWrappedRedeemed;        // All-time wrapped tokens redeemed back to ancient
    
    // === NET ACCOUNTING (Current State) ===
    uint256 public netBridgeDeposited;          // Current pending bridge deposits
    uint256 public netBridgedOut;               // Net tokens currently on other chains
    uint256 public netAncientLocked;            // Net ancient tokens locked in contract

    mapping(address => uint256[]) public holderBridgeInList;
    mapping(address => uint256[]) public holderBridgeOutList;
    mapping(address => uint256[]) public holderWrapOperationList;
    
    enum DepositOutStatus {
        Awaiting,   // 0
        Canceled,   // 1
        Locked,     // 2
        Finalized   // 3
    }
    
    enum DepositInStatus {
        Awaiting,   // 0
        Finalized,   // 1
        Invalid      // 2
    }
    
    struct ProofDepositOut {
        uint256 depositOutId; 
        address depositor;
        uint256 amount;
        string receivingWalletAddress;
        string chain;
        DepositOutStatus status;
        string txRelease;
        uint256 timestamp;
    }
    
    struct ProofDepositIn {
        uint256 depositInId;
        address depositor;
        uint256 amount;
        address receivingWalletAddress;
        string chain;
        DepositInStatus status;
        string txDepositProof; 
        uint256 timestamp;
    }

    enum WrapOperationType {
        WRAP,   // 0
        UNWRAP  // 1
    }
    struct AncientWrapOperation {
        uint256 wrapOperationId;
        address user;
        uint256 amount;
        WrapOperationType operationType;
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    mapping(uint256 => ProofDepositOut) public depositsOut;
    mapping(uint256 => ProofDepositIn) public depositsIn;
    mapping(uint256 => AncientWrapOperation) public ancientWrapOperations;
    
    event DepositOutRequested(
        address indexed depositor,
        uint256 indexed depositOutId,
        uint256 amount,
        string receivingWalletAddress,
        string chain,
        DepositOutStatus status
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
        uint256 totalBridgeCanceled,
        uint256 totalBridgedOut,
        uint256 totalBridgedIn,
        uint256 totalAncientWrapped,
        uint256 totalWrappedRedeemed,
        uint256 netBridgeDeposited,
        uint256 netBridgedOut,
        uint256 netAncientLocked,
        uint256 availableInventory
    );
    
    enum AccountingField {
        NET_BRIDGE_DEPOSITED,
        NET_BRIDGED_OUT,
        NET_ANCIENT_LOCKED,
        TOTAL_BRIDGE_DEPOSITED,
        TOTAL_BRIDGE_CANCELED,
        TOTAL_BRIDGED_OUT,
        TOTAL_BRIDGED_IN,
        TOTAL_ANCIENT_WRAPPED,
        TOTAL_WRAPPED_REDEEMED
    }

    event AccountingAdjustment(
        AccountingField indexed field,
        uint256 oldValue,
        uint256 newValue,
        string reason,
        bytes32 proofHash
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
        require(tokenAddress != ancientTokenAddress, "Token addresses must be different");
        
        token = IERC20(tokenAddress);
        ancient_token = IERC20(ancientTokenAddress);
        feeTreasury = _feeTreasury;
    }

    /**
     * @dev Safely transfers tokens and returns actual amount received
     * Handles fee-on-transfer and deflationary tokens correctly
     */
    function _safeTransferFromAndGetActual(
        IERC20 tokenContract, 
        address from, 
        address to, 
        uint256 amount
    ) internal returns (uint256 actualReceived) {
        uint256 balanceBefore = tokenContract.balanceOf(to);
        tokenContract.safeTransferFrom(from, to, amount);
        actualReceived = tokenContract.balanceOf(to) - balanceBefore;
    }
    
    function depositToBridgeOut(
        uint256 tokenAmount,
        string calldata receivingWalletAddress,
        string calldata chain
    ) external payable nonReentrant {
        require(msg.value == BRIDGE_FEE, "Incorrect bridge fee");
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(tokenAmount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(tokenAmount <= MAX_BRIDGE_AMOUNT, "Amount exceeds maximum");
        require(bytes(receivingWalletAddress).length > 0, "Receiving wallet address required");
        require(bytes(receivingWalletAddress).length <= 100, "Receiving wallet address too long");
        require(bytes(chain).length > 0, "Chain required");
        require(bytes(chain).length <= 50, "Chain name too long");
        
        // Check user has sufficient balance
        require(token.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");
        
        // Check inventory using net accounting
        require(getAvailableBridgeInventory() >= tokenAmount, "Insufficient bridge inventory");
        
        // Transfer tokens from user to this contract and get actual amount received
        uint256 actualTokensReceived = _safeTransferFromAndGetActual(
            token, 
            msg.sender, 
            address(this), 
            tokenAmount
        );
        
        // Create deposit record with actual amount received
        depositsOut[depositOutCounter] = ProofDepositOut({
            depositOutId: depositOutCounter,
            depositor: msg.sender,
            amount: actualTokensReceived,
            receivingWalletAddress: receivingWalletAddress,
            chain: chain,
            status: DepositOutStatus.Awaiting,
            txRelease: "",
            timestamp: block.timestamp
        });
        
        // Update accounting - HISTORICAL totals only increase with actual amount
        totalBridgeDeposited += actualTokensReceived;
        netBridgeDeposited += actualTokensReceived;
        
        emit DepositOutRequested(
            msg.sender,
            depositOutCounter,
            actualTokensReceived,
            receivingWalletAddress,
            chain,
            DepositOutStatus.Awaiting
        );

        // Emit accounting update
        _emitAccountingUpdate();
        
        holderBridgeOutList[msg.sender].push(depositOutCounter);
        depositOutCounter++;
        
        // Transfer bridge fee to fee recipient LAST (reentrancy protection)
        (bool success, ) = feeTreasury.call{value: msg.value}("");
        require(success, "Fee transfer failed");
    }
    
    function depositToBridgeIn(
        address receivingWalletAddress,
        string calldata chain,
        string calldata txDepositProof
    ) external payable nonReentrant {
        require(msg.value == BRIDGE_FEE, "Incorrect bridge fee");
        require(receivingWalletAddress != address(0), "Receiving wallet address required");
        require(bytes(chain).length > 0, "Chain required");
        require(bytes(chain).length <= 50, "Chain name too long");
        require(bytes(txDepositProof).length > 0, "Deposit proof required");
        require(bytes(txDepositProof).length <= 200, "Deposit proof too long");
        
        // Create deposit in record with txDepositProof
        depositsIn[depositInCounter] = ProofDepositIn({
            depositInId: depositInCounter,
            depositor: msg.sender,
            amount: 0,
            receivingWalletAddress: receivingWalletAddress,
            chain: chain,
            status: DepositInStatus.Awaiting,
            txDepositProof: txDepositProof,
            timestamp: block.timestamp
        });
        
        // Emit event
        emit DepositInRequested(
            msg.sender,
            depositInCounter,
            0,
            receivingWalletAddress,
            chain,
            DepositInStatus.Awaiting
        );
        
        holderBridgeInList[msg.sender].push(depositInCounter);
        depositInCounter++;
        
        // Transfer bridge fee to fee recipient LAST (reentrancy protection)
        (bool success, ) = feeTreasury.call{value: msg.value}("");
        require(success, "Fee transfer failed");
    }
    
    function cancelBridge(uint256 depositOutId) external nonReentrant {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        require(dep.depositor == msg.sender, "Only depositor can cancel");
        require(dep.status == DepositOutStatus.Awaiting, "Can only cancel awaiting deposits");
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= dep.amount, "Insufficient contract balance");
        
        // Ensure we don't underflow net accounting
        require(netBridgeDeposited >= dep.amount, "Net accounting underflow protection");
        
        // Update deposit status
        dep.status = DepositOutStatus.Canceled;
        
        // Update accounting - HISTORICAL totals remain unchanged, only net changes
        totalBridgeCanceled += dep.amount;  // NEW: Track cancellations
        netBridgeDeposited -= dep.amount;    // Decrease pending
        
        // Transfer tokens back to depositor
        token.safeTransfer(msg.sender, dep.amount);
        
        emit CancelDepositOut(msg.sender, depositOutId, dep.amount);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }
    
    function lockDeposit(uint256 depositOutId, bool lock) external onlyOwner {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        
        if (lock) {
            require(dep.status == DepositOutStatus.Awaiting, "Can only lock awaiting deposits");
            dep.status = DepositOutStatus.Locked;
        } else {
            require(dep.status == DepositOutStatus.Locked, "Can only unlock locked deposits");
            dep.status = DepositOutStatus.Awaiting;
        }
        
        // Emit event with lock status
        emit LockDepositOut(depositOutId, dep.amount, lock);
    }
    
    function finalizeBridgeOut(uint256 depositOutId, string calldata txHash) external onlyOwner {
        require(depositOutId < depositOutCounter, "Invalid deposit ID");
        require(bytes(txHash).length > 0, "Transaction hash required");
        require(bytes(txHash).length <= 200, "Transaction hash too long");
        
        ProofDepositOut storage dep = depositsOut[depositOutId];
        require(dep.status == DepositOutStatus.Locked, "Can only finalize locked deposits");
        
        uint256 finalizeAmount = dep.amount;
        
        // Verify contract has sufficient balance (tokens stay in vault)
        require(token.balanceOf(address(this)) >= finalizeAmount, "Insufficient contract balance");
        
        // Ensure we don't underflow
        require(netBridgeDeposited >= finalizeAmount, "Net accounting underflow protection");
        
        // Update accounting
        totalBridgedOut += finalizeAmount;           // Historical tracking
        netBridgedOut += finalizeAmount;               // Increase net tokens on other chains
        netBridgeDeposited -= finalizeAmount;     // Remove from pending
        
        // Update deposit status and set txRelease
        dep.status = DepositOutStatus.Finalized;
        dep.txRelease = txHash;
        
        // Emit event
        emit BridgeOutFinalized(depositOutId, finalizeAmount, txHash);
        
        // Emit accounting update
        _emitAccountingUpdate();

    (bool valid, string memory error) = verifyAccountingIntegrity();
    require(valid, string(abi.encodePacked("Operation broke integrity: ", error)));
    }
    
    function finalizeBridgeIn(
        uint256 depositInId, 
        uint256 tokenAmount,
        bool isValid
    ) external onlyOwner nonReentrant {
        require(depositInId < depositInCounter, "Invalid deposit in ID");
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(tokenAmount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(tokenAmount <= MAX_BRIDGE_AMOUNT, "Amount exceeds maximum");
        
        ProofDepositIn storage depIn = depositsIn[depositInId];
        require(depIn.status == DepositInStatus.Awaiting, "Can only finalize awaiting deposits");
        
        // Update the amount in the deposit record
        depIn.amount = tokenAmount;
        
        // Check if the deposit is valid
        if (!isValid) {
            // Mark as invalid and emit event but don't process the bridge
            depIn.status = DepositInStatus.Invalid;
            
            emit BridgeInFinalized(
                depositInId,
                depIn.depositor,
                depIn.amount,
                depIn.txDepositProof
            );
            
            return; // Exit early without processing the bridge
        }
        
        // Verify contract has sufficient balance
        require(token.balanceOf(address(this)) >= depIn.amount, "Insufficient contract balance");
        
        // CRITICAL: Only check if we have tokens bridged out to bring back
        require(netBridgedOut >= depIn.amount, "Insufficient tokens on other chains to bridge back");
        
        // Update deposit in record
        depIn.status = DepositInStatus.Finalized;
        
        // Update accounting
        totalBridgedIn += depIn.amount;               // Historical tracking
        netBridgedOut -= depIn.amount;                 // Decrease net tokens on other chains
        
        // Transfer tokens from vault to the receiving address
        token.safeTransfer(depIn.receivingWalletAddress, depIn.amount);
        
        emit BridgeInFinalized(
            depositInId,
            depIn.depositor,
            depIn.amount,
            depIn.txDepositProof
        );
        
        // Emit accounting update
        _emitAccountingUpdate();
    }


    // emergancy override to handle accounting edge cases that result in stuck tokens
    function setAccountingValue(
        AccountingField field,
        uint256 newValue,
        string calldata reason,
        bytes32 proofHash
    ) external onlyOwner {
        require(bytes(reason).length >= 20, "Detailed reason required");
        require(proofHash != bytes32(0), "Proof hash required");
        
        uint256 oldValue;
        
        if (field == AccountingField.NET_BRIDGE_DEPOSITED) {
            oldValue = netBridgeDeposited;
            netBridgeDeposited = newValue;
            
        } else if (field == AccountingField.NET_BRIDGED_OUT) {
            oldValue = netBridgedOut;
            netBridgedOut = newValue;
            
        } else if (field == AccountingField.NET_ANCIENT_LOCKED) {
            oldValue = netAncientLocked;
            netAncientLocked = newValue;
            
        } else if (field == AccountingField.TOTAL_BRIDGE_DEPOSITED) {
            oldValue = totalBridgeDeposited;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalBridgeDeposited = newValue;
            
        } else if (field == AccountingField.TOTAL_BRIDGE_CANCELED) {
            oldValue = totalBridgeCanceled;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalBridgeCanceled = newValue;
            
        } else if (field == AccountingField.TOTAL_BRIDGED_OUT) {
            oldValue = totalBridgedOut;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalBridgedOut = newValue;
            
        } else if (field == AccountingField.TOTAL_BRIDGED_IN) {
            oldValue = totalBridgedIn;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalBridgedIn = newValue;
            
        } else if (field == AccountingField.TOTAL_ANCIENT_WRAPPED) {
            oldValue = totalAncientWrapped;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalAncientWrapped = newValue;
            
        } else if (field == AccountingField.TOTAL_WRAPPED_REDEEMED) {
            oldValue = totalWrappedRedeemed;
            require(newValue >= oldValue, "Total values cannot decrease");
            totalWrappedRedeemed = newValue;
        }
        
        emit AccountingAdjustment(field, oldValue, newValue, reason, proofHash);
        
        // Disabled integrity check to allow partial step by step overrides
        // // Run integrity check
        // (bool valid, string memory error) = verifyAccountingIntegrity();
        // require(valid, string(abi.encodePacked("Adjustment breaks integrity: ", error)));
    }
    
    function wrapAncientForToken(uint256 ancientAmount) external nonReentrant {
        require(ancientAmount > 0, "Amount must be greater than zero");
        require(ancientAmount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(ancientAmount <= MAX_BRIDGE_AMOUNT, "Amount exceeds maximum");
        
        // Check user has sufficient ancient token balance
        require(ancient_token.balanceOf(msg.sender) >= ancientAmount, "Insufficient ancient token balance");
        
        // Transfer ancient tokens from user to this contract and get actual amount received
        uint256 actualAncientReceived = _safeTransferFromAndGetActual(
            ancient_token, 
            msg.sender, 
            address(this), 
            ancientAmount
        );
        
        // Verify contract has sufficient new token balance for the actual amount received
        require(token.balanceOf(address(this)) >= actualAncientReceived, "Insufficient token balance");
        
        // Update accounting for wrapping with actual amount received
        totalAncientWrapped += actualAncientReceived;     // Historical wrapping
        netAncientLocked += actualAncientReceived;           // Current ancient tokens locked

        // Record the operation
        ancientWrapOperations[wrapOperationCounter] = AncientWrapOperation({
            wrapOperationId: wrapOperationCounter,
            user: msg.sender,
            amount: actualAncientReceived,
            operationType: WrapOperationType.WRAP,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        holderWrapOperationList[msg.sender].push(wrapOperationCounter);
        wrapOperationCounter++;
        
        // Transfer new tokens to user (equivalent to what we actually received)
        token.safeTransfer(msg.sender, actualAncientReceived);
        
        // Emit event with actual amounts
        emit AncientTokenWrapped(msg.sender, actualAncientReceived, actualAncientReceived);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }

    function unwrapTokenForAncient(uint256 tokenAmount) external nonReentrant {
        require(unwrapEnabled, "Unwrapping is currently disabled");
        require(tokenAmount > 0, "Amount must be greater than zero");
        require(tokenAmount >= MIN_BRIDGE_AMOUNT, "Amount below minimum");
        require(tokenAmount <= MAX_BRIDGE_AMOUNT, "Amount exceeds maximum");
        
        // Check user has sufficient token balance
        require(token.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");
        
        // Transfer tokens from user to this contract and get actual amount received
        uint256 actualTokensReceived = _safeTransferFromAndGetActual(
            token, 
            msg.sender, 
            address(this), 
            tokenAmount
        );
        
        // Ensure we have enough ancient tokens locked to release for the actual amount received
        require(netAncientLocked >= actualTokensReceived, "Insufficient ancient token inventory");
        
        // Verify contract has sufficient ancient token balance for the actual amount received
        require(ancient_token.balanceOf(address(this)) >= actualTokensReceived, "Insufficient ancient token balance");
        
        // Update accounting for unwrapping with actual amount received
        totalWrappedRedeemed += actualTokensReceived;     // Historical unwrapping
        netAncientLocked -= actualTokensReceived;             // Current ancient tokens locked decreases

        // Record the operation
        ancientWrapOperations[wrapOperationCounter] = AncientWrapOperation({
            wrapOperationId: wrapOperationCounter,
            user: msg.sender,
            amount: actualTokensReceived,
            operationType: WrapOperationType.UNWRAP,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        holderWrapOperationList[msg.sender].push(wrapOperationCounter);
        wrapOperationCounter++;
        
        // Transfer ancient tokens to user (equivalent to what we actually received)
        ancient_token.safeTransfer(msg.sender, actualTokensReceived);
        
        // Emit event with actual amounts
        emit AncientTokenUnwrapped(msg.sender, actualTokensReceived, actualTokensReceived);
        
        // Emit accounting update
        _emitAccountingUpdate();
    }

    function toggleUnwrapAncient(bool enabled) external onlyOwner {
        unwrapEnabled = enabled;
    }
    
    function setfeeTreasury(address newfeeTreasury) external onlyOwner {
        require(newfeeTreasury != address(0), "Invalid fee recipient address");
        feeTreasury = newfeeTreasury;
    }
    
    function changeAdmin(address newAdminAddr) external onlyOwner {
        require(newAdminAddr != address(0), "Invalid admin address");
        _transferOwnership(newAdminAddr);
    }
    
    // Emergency function to withdraw stuck ETH (fees)
    function withdrawStuckETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "ETH transfer failed");
    }
    
    // Internal function to emit comprehensive accounting updates
    function _emitAccountingUpdate() internal {
        emit AccountingUpdate(
            totalBridgeDeposited,
            totalBridgeCanceled,
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
    
    // Updated inventory calculation using net accounting
    function getAvailableBridgeInventory() public view returns (uint256) {
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= netBridgeDeposited, "Accounting corruption detected");
        return contractBalance - netBridgeDeposited;
    }

    // NEW: Comprehensive accounting information with both total and net
    function getFullAccountingInfo() external view returns (
        // Historical totals
        uint256 totalBridgeDeposited_,
        uint256 totalBridgeCanceled_,
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
        uint256 availableInventory
    ) {
        return (
            totalBridgeDeposited,
            totalBridgeCanceled,
            totalBridgedOut,
            totalBridgedIn,
            totalAncientWrapped,
            totalWrappedRedeemed,
            netBridgeDeposited,
            netBridgedOut,
            netAncientLocked,
            token.balanceOf(address(this)),
            ancient_token.balanceOf(address(this)),
            getAvailableBridgeInventory()
        );
    }

    // Enhanced integrity checks for both accounting systems
    function verifyAccountingIntegrity() public view returns (bool isValid, string memory error) {
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
        
        // Check 8: Total bridge deposited should be >= total bridge canceled
        if (totalBridgeDeposited < totalBridgeCanceled) {
            return (false, "Total canceled exceeds total deposited");
        }
        
        // Check 9: Net bridge deposited should be >= 0
        if (netBridgeDeposited > totalBridgeDeposited) {
            return (false, "Net bridge deposited exceeds total");
        }
        
        return (true, "Full accounting integrity verified");
    }

    // Get holder's bridge history with pagination
    function getHolderBridgeOutHistory(address holder, uint256 offset, uint256 limit) 
        external view returns (uint256[] memory depositIds) {
        uint256[] storage holderList = holderBridgeOutList[holder];
        uint256 length = holderList.length;
        
        if (offset >= length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        uint256 resultLength = end - offset;
        depositIds = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            depositIds[i] = holderList[offset + i];
        }
        
        return depositIds;
    }
    
    // Get holder's bridge in history with pagination
    function getHolderBridgeInHistory(address holder, uint256 offset, uint256 limit) 
        external view returns (uint256[] memory depositIds) {
        uint256[] storage holderList = holderBridgeInList[holder];
        uint256 length = holderList.length;
        
        if (offset >= length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        uint256 resultLength = end - offset;
        depositIds = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            depositIds[i] = holderList[offset + i];
        }
        
        return depositIds;
    }

    // Get holder's ancient wrap/unwrap history with pagination
    function getHolderAncientHistory(address holder, uint256 offset, uint256 limit) 
        external view returns (uint256[] memory operationIds) {
        uint256[] storage holderList = holderWrapOperationList[holder];
        uint256 length = holderList.length;
        
        if (offset >= length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        uint256 resultLength = end - offset;
        operationIds = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            operationIds[i] = holderList[offset + i];
        }
        
        return operationIds;
    }

    function manualTransfer(
        address tokenAddress,
        uint256 amount,
        address destinationWallet
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(destinationWallet != address(0), "Invalid destination wallet");
        require(amount > 0, "Amount must be greater than zero");
        
        IERC20 tokenContract = IERC20(tokenAddress);
        require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient contract balance");
        
        tokenContract.safeTransfer(destinationWallet, amount);
    }
}