// npx hardhat ignition deploy ./ignition/modules/BridgeVault.deploy.ts --network base --verify
// enable optimizer in hardhat.config.ts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const FEE_TREASURY = "0xFCa6Ea0D66124907737a8EE145B207F2F55d725a";

const TOKEN_ADDRESS = "0xe9fd3AbbE02E04c1f01Eea56FC9B022fFda38736";
const ANCIENT_TOKEN_ADDRESS = "0x766506Cdb3dEA84d44c99cB6122D735583786a62";

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
