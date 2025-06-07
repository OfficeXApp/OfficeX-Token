// npx hardhat ignition deploy ./ignition/modules/Wings.deploy.ts --network base --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0x1e8133a74C3Ed3669210860451BF4db2b9c25887";
const TREASURY_ADDRESS = "0xFCa6Ea0D66124907737a8EE145B207F2F55d725a";
// const ALLOWLIST_ADDRESSES = [

const WingsModule = buildModule("WingsModule", (m) => {
  // Deploy the Wings contract with the admin address
  const wings = m.contract("Wings", [ADMIN_ADDRESS, TREASURY_ADDRESS]);

  //   // Add post-deployment configuration for allowlist
  //   ALLOWLIST_ADDRESSES.forEach((address, index) => {
  //     m.call(wings, "addToAllowlist", [address], {
  //       id: `add_to_allowlist_${index + 1}`,
  //     });
  //   });

  return { wings };
});

export default WingsModule;

/**
 * 

// To deploy on local forge (where our bridge is deployed)

forge create --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast \
  contracts/Wings.sol:Wings \
  --constructor-args "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

 */
