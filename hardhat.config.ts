import dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Load environment variables from .env
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    arbitrum: {
      url: ARBITRUM_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    hardhat: {
      forking: {
        url: SEPOLIA_RPC_URL,
        blockNumber: 7000420,
      },
    },
  },
};

export default config;
