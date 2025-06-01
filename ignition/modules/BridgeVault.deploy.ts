// npx hardhat ignition deploy ./ignition/modules/BridgeVault.deploy.ts --network base --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
// const ADMIN_ADDRESS = "0xc68ae4c50D5b376434db7EAA12EA089466F65Bd8";
const TOKEN_ADDRESS = "0x4E9E4d2c145d5Df6D8eBCfBa947a6406F46d5BE0";

const BridgeVaultModule = buildModule("BridgeVaultModule", (m) => {
  // Deploy the BridgeVault contract with the admin address
  const bridgevault = m.contract("BridgeVault", [TOKEN_ADDRESS, ADMIN_ADDRESS]);

  return { bridgevault };
});

export default BridgeVaultModule;
