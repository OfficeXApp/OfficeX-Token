// Contract addresses and constants
export const ANCIENT_BASE_TOKEN = "0xaC441DB73794D8716496199D8b6af44e939b810F";
export const BASE_TOKEN = "0xB63E5600Bb251D7AeDe2CcA2c0C18c56c7FcD816";
export const BRIDGE_BASE_CONTRACT_ADDRESS =
  "0x6cd40E13Fa9F23d8690ea62236fe18e8d56C518e";
export const SOLANA_TOKEN = "mntp4nmZjsdRZzJ8h4JXPyq4xi5rfoc3pcJgfQhyxmy";
export const SOLANA_BRIDGE_WALLET =
  "56Hkvv6vKCUibhFy1y4wT8eq7cgqD6mXqhzenPpnV2UL";

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
