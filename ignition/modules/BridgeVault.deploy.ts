// npx hardhat ignition deploy ./ignition/modules/BridgeVault.deploy.ts --network base --verify
// enable optimizer in hardhat.config.ts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const FEE_TREASURY = "0xFCa6Ea0D66124907737a8EE145B207F2F55d725a";

const TOKEN_ADDRESS = "0xf989de40C3D0010446260fc8666D2A4a6f8b7173";
const ANCIENT_TOKEN_ADDRESS = "0x364d9Eba8b050E3529e161eA5032C279dA6BAF8b";

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
