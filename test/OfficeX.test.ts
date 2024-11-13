import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("OfficeX", function () {
  async function deployTokenFixture() {
    const NAME = "OfficeX";
    const SYMBOL = "OFX";
    const INITIAL_SUPPLY = hre.ethers.parseEther("210000000"); // 210 million tokens

    // Get signers
    const [owner, addr1, addr2, addr3] = await hre.ethers.getSigners();

    // Deploy token
    const OfficeX = await hre.ethers.getContractFactory("OfficeX");
    const token = await OfficeX.deploy(owner.address);

    return { token, owner, addr1, addr2, addr3, INITIAL_SUPPLY };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("OfficeX");
      expect(await token.symbol()).to.equal("OFFICEX");
    });

    it("Should set the right owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should mint initial supply to deployer", async function () {
      const { token, owner, INITIAL_SUPPLY } = await loadFixture(
        deployTokenFixture
      );

      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should add deployer and owner to allowlist", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.allowlist(owner.address)).to.be.true;
    });
  });

  describe("Allowlist Management", function () {
    it("Should allow owner to add address to allowlist", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.addToAllowlist(addr1.address))
        .to.emit(token, "AddedToAllowlist")
        .withArgs(addr1.address);

      expect(await token.allowlist(addr1.address)).to.be.true;
    });

    it("Should allow owner to remove address from allowlist", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await token.addToAllowlist(addr1.address);
      await expect(token.removeFromAllowlist(addr1.address))
        .to.emit(token, "RemovedFromAllowlist")
        .withArgs(addr1.address);

      expect(await token.allowlist(addr1.address)).to.be.false;
    });

    it("Should not allow non-owner to add to allowlist", async function () {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(addr1).addToAllowlist(addr2.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow adding zero address to allowlist", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      await expect(
        token.addToAllowlist(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should not allow adding already allowlisted address", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);

      await token.addToAllowlist(addr1.address);
      await expect(token.addToAllowlist(addr1.address)).to.be.revertedWith(
        "Address already allowlisted"
      );
    });

    it("Should not remove already removed address from allowlist", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.removeFromAllowlist(addr1.address)).to.be.revertedWith(
        "Address not allowlisted"
      );
    });
  });

  describe("Transfer Mechanics", function () {
    it("Should transfer full amount between allowlisted addresses", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const transferAmount = hre.ethers.parseEther("1000");

      await token.addToAllowlist(addr1.address);
      await token.transfer(addr1.address, transferAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should apply 1% burn on transfer between non-allowlisted addresses", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const transferAmount = hre.ethers.parseEther("1000");
      const expectedBurn = (transferAmount * 100n) / 10000n; // 1%
      const expectedReceived = transferAmount - expectedBurn;

      // First transfer to non-allowlisted address (from allowlisted owner)
      await token.transfer(addr1.address, transferAmount);

      // Then transfer between non-allowlisted addresses
      await expect(token.connect(addr1).transfer(addr2.address, transferAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(addr1.address, expectedBurn);

      expect(await token.balanceOf(addr2.address)).to.equal(expectedReceived);
    });

    it("Should not burn when sender is allowlisted", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const transferAmount = hre.ethers.parseEther("1000");

      await token.transfer(addr1.address, transferAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should not burn when recipient is allowlisted", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const transferAmount = hre.ethers.parseEther("1000");

      await token.addToAllowlist(addr2.address);
      await token.transfer(addr1.address, transferAmount);
      await token.connect(addr1).transfer(addr2.address, transferAmount);

      expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
    });

    it("Should revert when transferring to zero address (OpenZeppelin Implementation)", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const transferAmount = hre.ethers.parseEther("1000");

      await expect(token.transfer(hre.ethers.ZeroAddress, transferAmount)).to.be
        .reverted;
    });

    it("Should revert when transfer amount is zero", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.transfer(addr1.address, 0)).to.be.revertedWith(
        "Transfer amount must be greater than zero"
      );
    });
  });
});
