// npx hardhat ignition deploy ./ignition/modules/MockUSDT.ts --network sepolia --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RECIPIENT_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const INITIAL_SUPPLY_PAY = 10_000_000_000_000; // 10 million tokens with 6 decimals

const TokenDeploymentModule = buildModule("TokenDeploymentModule", (m) => {
  // Deploy PAY token
  const payToken = m.contract("MockUSDT", ["Tether USD", "USDT", 6n], {
    id: "Tether",
  });

  // Mint PAY tokens after deployment
  m.call(payToken, "mint", [RECIPIENT_ADDRESS, INITIAL_SUPPLY_PAY], {
    id: "mintPayTokens",
  });

  // Return only the contract deployments
  return {
    payToken,
  };
});

export default TokenDeploymentModule;
