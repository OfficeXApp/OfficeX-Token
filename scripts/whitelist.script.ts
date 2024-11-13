// npx hardhat run scripts/whitelist.script.ts --network sepolia

import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

import { OfficeX } from "../typechain-types/contracts/OfficeX";

const CONTRACT_ADDRESS = "0x5E7d6004E633A5E3c12f4C94c098a2404628B54D"; // Sepolia
// const CONTRACT_ADDRESS = "__________________"; // Polygon

const ALLOWLIST_ADDRESSES = [
  "0xc68ae4c50D5b376434db7EAA12EA089466F65Bd8", // admin
  //   "______________", // fund contract
  //   "0x9641d764fc13c8B624c04430C7356C1C7C8102e2", // vesting contract
  //   "0xd8B085f666299E52f24e637aB1076ba5C2c38045", // vesting contract
];

async function main() {
  try {
    // Check if private key exists
    if (!process.env.ADMIN_PRIVATE_KEY) {
      throw new Error("ADMIN_PRIVATE_KEY not found in environment variables");
    }

    // Create wallet from private key
    const provider = ethers.provider;
    const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

    // Get contract instance
    const OfficeX = await ethers.getContractFactory("OfficeX");
    const token = OfficeX.attach(CONTRACT_ADDRESS) as OfficeX;

    // Connect wallet to contract
    const tokenWithSigner = token.connect(wallet);

    console.log("Starting whitelist process...");

    // Add addresses to whitelist
    for (const address of ALLOWLIST_ADDRESSES) {
      try {
        // Check if address is already whitelisted
        const isWhitelisted = await token.allowlist(address);

        if (isWhitelisted) {
          console.log(`Address ${address} is already whitelisted, skipping...`);
          continue;
        }

        // Add to whitelist
        const tx = await tokenWithSigner.addToAllowlist(address);
        await tx.wait();

        console.log(`Successfully whitelisted address: ${address}`);
        console.log(`Transaction hash: ${tx.hash}`);

        // Add small delay between transactions
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error whitelisting address ${address}:`, error);
      }
    }

    console.log("Whitelist process completed!");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
