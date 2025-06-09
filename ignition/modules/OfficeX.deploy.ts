// npx hardhat ignition deploy ./ignition/modules/OfficeX.deploy.ts --network base --verify

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ADMIN_ADDRESS = "0xBf9DF0E6C1ff289D32b0924cdbfb36524B85f963";
const TREASURY_ADDRESS = "0xBf9DF0E6C1ff289D32b0924cdbfb36524B85f963";

const OfficeXModule = buildModule("OfficeXModule", (m) => {
  // Deploy the OfficeX contract with the admin address
  const officex = m.contract("OfficeX", [ADMIN_ADDRESS, TREASURY_ADDRESS]);

  return { officex };
});

export default OfficeXModule;
