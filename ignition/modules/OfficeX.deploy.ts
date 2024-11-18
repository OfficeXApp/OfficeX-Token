// npx hardhat ignition deploy ./ignition/modules/OfficeX.deploy.ts --network sepolia --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0xBf9DF0E6C1ff289D32b0924cdbfb36524B85f963";
// const ADMIN_ADDRESS = "0xc68ae4c50D5b376434db7EAA12EA089466F65Bd8";
// const ALLOWLIST_ADDRESSES = [
//   "0x1e8133a74C3Ed3669210860451BF4db2b9c25887",
//   "0xFCa6Ea0D66124907737a8EE145B207F2F55d725a",
// ];

const OfficeXModule = buildModule("OfficeXModule", (m) => {
  // Deploy the OfficeX contract with the admin address
  const officeX = m.contract("OfficeX", [ADMIN_ADDRESS]);

  //   // Add post-deployment configuration for allowlist
  //   ALLOWLIST_ADDRESSES.forEach((address, index) => {
  //     m.call(officeX, "addToAllowlist", [address], {
  //       id: `add_to_allowlist_${index + 1}`,
  //     });
  //   });

  return { officeX };
});

export default OfficeXModule;
