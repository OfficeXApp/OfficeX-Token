// Contract addresses and constants
export const ANCIENT_BASE_TOKEN = "0x946AaBdAdA2A2eF0535715a062685Ae886B08117";
export const BASE_TOKEN = "0x2c75445576BE17fD2dE0Fea019dB795Ea2b3Fa2E";
export const BRIDGE_BASE_CONTRACT_ADDRESS =
  "0x79e92547639Ec8D8900a8d752D011D3Da11c41Df";
export const SOLANA_TOKEN = "mntp4nmZjsdRZzJ8h4JXPyq4xi5rfoc3pcJgfQhyxmy";

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
      { name: "tokenAmount", type: "uint256" },
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
