// npx hardhat ignition deploy ./ignition/modules/BridgeVault.deploy.ts --network base --verify
// enable optimizer in hardhat.config.ts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0xbf1E25c0c515EAe1811A07B3bffB48bB4a0ff05F";
const FEE_TREASURY = "0xBf9DF0E6C1ff289D32b0924cdbfb36524B85f963";

const TOKEN_ADDRESS = "0x720b19b282C4df814369bfd91a8C1092C491735c";
const ANCIENT_TOKEN_ADDRESS = "0x48808407d95f691D076C90337d42eE3836656990";

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
