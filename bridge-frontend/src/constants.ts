// Contract addresses and constants
export const ANCIENT_BASE_TOKEN = "0x48808407d95f691D076C90337d42eE3836656990";
export const BASE_TOKEN = "0x720b19b282C4df814369bfd91a8C1092C491735c";
export const BRIDGE_BASE_CONTRACT_ADDRESS =
  "0xB876dA82435a46d4Abc1Ce0dCa22909aD603CFF6";
export const SOLANA_TOKEN = "ofxFDzjfM7AxfJvm95Zdg6x3NoPUYZoVakqeZqViG77";
export const SOLANA_BRIDGE_WALLET =
  "5AC5xNRkFRcPWLCTiQ2Tt8v97npEqjMzf2UT8gYgYfDK";

export const BRIDGE_FEE = "0.002"; // ETH

// ABIs
export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export const BRIDGE_VAULT_ABI = [
  {
    inputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "receivingWalletAddress", type: "string" },
      { name: "chain", type: "string" },
    ],
    name: "depositToBridgeOut",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "receivingWalletAddress", type: "address" },
      { name: "chain", type: "string" },
      { name: "txDepositProof", type: "string" },
    ],
    name: "depositToBridgeIn",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "ancientAmount", type: "uint256" }],
    name: "wrapAncientForToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    name: "unwrapTokenForAncient",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unwrapEnabled",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAvailableBridgeInventory",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BRIDGE_FEE",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "holderBridgeInList",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "holderBridgeOutList",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Deposit structs
  {
    inputs: [{ name: "depositOutId", type: "uint256" }],
    name: "depositsOut",
    outputs: [
      { name: "depositOutId", type: "uint256" },
      { name: "depositor", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "receivingWalletAddress", type: "string" },
      { name: "chain", type: "string" },
      { name: "status", type: "uint8" },
      { name: "txRelease", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "depositInId", type: "uint256" }],
    name: "depositsIn",
    outputs: [
      { name: "depositInId", type: "uint256" },
      { name: "depositor", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "receivingWalletAddress", type: "address" },
      { name: "chain", type: "string" },
      { name: "status", type: "uint8" },
      { name: "txDepositProof", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "depositOutCounter",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "depositInCounter",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Additional accounting functions that might be useful
  {
    inputs: [],
    name: "netAncientLocked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAncientWrapped",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalWrappedRedeemed",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Cancel bridge function
  {
    inputs: [{ name: "depositOutId", type: "uint256" }],
    name: "cancelBridge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Get full accounting info
  {
    inputs: [],
    name: "getFullAccountingInfo",
    outputs: [
      { name: "totalBridgeDeposited_", type: "uint256" },
      { name: "totalBridgeCanceled_", type: "uint256" },
      { name: "totalBridgedOut_", type: "uint256" },
      { name: "totalBridgedIn_", type: "uint256" },
      { name: "totalAncientWrapped_", type: "uint256" },
      { name: "totalWrappedRedeemed_", type: "uint256" },
      { name: "netBridgeDeposited_", type: "uint256" },
      { name: "netBridgedOut_", type: "uint256" },
      { name: "netAncientLocked_", type: "uint256" },
      { name: "tokenBalance", type: "uint256" },
      { name: "ancientBalance", type: "uint256" },
      { name: "availableInventory", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Get holder history with pagination
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    name: "getHolderBridgeOutHistory",
    outputs: [{ name: "depositIds", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    name: "getHolderBridgeInHistory",
    outputs: [{ name: "depositIds", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  // Constants
  {
    inputs: [],
    name: "MIN_BRIDGE_AMOUNT",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_BRIDGE_AMOUNT",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Token addresses
  {
    inputs: [],
    name: "token",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ancient_token",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "holderWrapOperationList",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wrapOperationId", type: "uint256" }],
    name: "ancientWrapOperations",
    outputs: [
      { name: "wrapOperationId", type: "uint256" },
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "operationType", type: "uint8" },
      { name: "timestamp", type: "uint256" },
      { name: "blockNumber", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "wrapOperationCounter",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    name: "getHolderAncientHistory",
    outputs: [{ name: "operationIds", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
];

export interface BridgeFormData {
  amount: string;
  recipientAddress: string;
  txDepositProof?: string;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string;
  balance: string;
}

export const formatWithCommas = (value: string) => {
  //   return value;
  const num = parseFloat(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
