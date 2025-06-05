// npx hardhat ignition deploy ./ignition/modules/BridgeVault.deploy.ts --network base --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const FEE_TREASURY = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const TOKEN_ADDRESS = "0x2c75445576BE17fD2dE0Fea019dB795Ea2b3Fa2E";
const ANCIENT_TOKEN_ADDRESS = "0x946AaBdAdA2A2eF0535715a062685Ae886B08117";

const BridgeVaultModule = buildModule("BridgeVaultModule", (m) => {
  // Deploy the BridgeVault contract with the admin address
  const bridgevault = m.contract("BridgeVault", [
    TOKEN_ADDRESS,
    ANCIENT_TOKEN_ADDRESS,
    ADMIN_ADDRESS,
    FEE_TREASURY,
  ]);

  return { bridgevault };
});

export default BridgeVaultModule;
