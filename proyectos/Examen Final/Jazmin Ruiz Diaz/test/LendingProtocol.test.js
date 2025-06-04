const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingProtocol", function () {
  let owner, user1, user2;
  let collateralToken, loanToken, lendingProtocol;

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const CollateralToken = await ethers.getContractFactory("CollateralToken");
    collateralToken = await CollateralToken.deploy();
    await collateralToken.deployed();

    const LoanToken = await ethers.getContractFactory("LoanToken");
    loanToken = await LoanToken.deploy();
    await loanToken.deployed();

    const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
    lendingProtocol = await LendingProtocol.deploy(
      collateralToken.address,
      loanToken.address
    );
    await lendingProtocol.deployed();

    // Mint tokens for testing
    await collateralToken.mint(owner.address, ethers.utils.parseEther("10000"));
    await loanToken.mint(
      lendingProtocol.address,
      ethers.utils.parseEther("10000")
    );

    // Transfer some collateral tokens to user1 for testing
    await collateralToken.transfer(
      user1.address,
      ethers.utils.parseEther("1000")
    );
  });

  describe("Token Deployment", function () {
    it("Should deploy CollateralToken with correct name and symbol", async function () {
      expect(await collateralToken.name()).to.equal("Collateral USD");
      expect(await collateralToken.symbol()).to.equal("cUSD");
    });

    it("Should deploy LoanToken with correct name and symbol", async function () {
      expect(await loanToken.name()).to.equal("Debt DAI");
      expect(await loanToken.symbol()).to.equal("dDAI");
    });
  });

  describe("Deposit Collateral", function () {
    it("Should allow users to deposit collateral", async function () {
      const amount = ethers.utils.parseEther("100");

      // Approve the lending protocol to spend user1's tokens
      await collateralToken
        .connect(user1)
        .approve(lendingProtocol.address, amount);

      // Deposit collateral
      await lendingProtocol.connect(user1).depositCollateral(amount);

      // Check user data
      const [collateral] = await lendingProtocol.getUserData(user1.address);
      expect(collateral).to.equal(amount);
    });

    it("Should reject zero amount deposits", async function () {
      await expect(
        lendingProtocol.connect(user1).depositCollateral(0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Borrow", function () {
    it("Should allow users to borrow up to 66% of collateral", async function () {
      const collateralAmount = ethers.utils.parseEther("150");
      const borrowAmount = ethers.utils.parseEther("100"); // 150% collateralization

      // Approve and deposit more collateral
      await collateralToken
        .connect(user1)
        .approve(lendingProtocol.address, collateralAmount);
      await lendingProtocol.connect(user1).depositCollateral(collateralAmount);

      // Borrow
      await lendingProtocol.connect(user1).borrow(borrowAmount);

      // Check user data
      const [, debt] = await lendingProtocol.getUserData(user1.address);
      expect(debt).to.equal(borrowAmount);
    });

    it("Should reject borrows exceeding collateral limit", async function () {
      const borrowAmount = ethers.utils.parseEther("101"); // Slightly over 66% of 150

      await expect(
        lendingProtocol.connect(user1).borrow(borrowAmount)
      ).to.be.revertedWith("Borrow amount exceeds collateral limit");
    });

    it("Should reject borrows with no collateral", async function () {
      await expect(
        lendingProtocol.connect(user2).borrow(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("No collateral deposited");
    });
  });

  describe("Repay", function () {
    it("Should allow users to repay their debt", async function () {
      const repayAmount = ethers.utils.parseEther("100");

      // Approve the lending protocol to spend user1's loan tokens
      await loanToken
        .connect(user1)
        .approve(lendingProtocol.address, repayAmount);

      // Repay
      await lendingProtocol.connect(user1).repay();

      // Check user data
      const [, debt] = await lendingProtocol.getUserData(user1.address);
      expect(debt).to.equal(0);
    });

    it("Should apply interest when repaying", async function () {
      // Deposit collateral
      const collateralAmount = ethers.utils.parseEther("150");
      await collateralToken
        .connect(user2)
        .approve(lendingProtocol.address, collateralAmount);
      await lendingProtocol.connect(user2).depositCollateral(collateralAmount);

      // Borrow
      const borrowAmount = ethers.utils.parseEther("100");
      await lendingProtocol.connect(user2).borrow(borrowAmount);

      // Fast forward time (simulate)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 1 week
      await ethers.provider.send("evm_mine");

      // Approve repayment
      const repaymentAmount = ethers.utils.parseEther("105"); // 5% interest
      await loanToken.mint(user2.address, repaymentAmount);
      await loanToken
        .connect(user2)
        .approve(lendingProtocol.address, repaymentAmount);

      // Repay
      await lendingProtocol.connect(user2).repay();

      // Check user data
      const [, debt] = await lendingProtocol.getUserData(user2.address);
      expect(debt).to.equal(0);
    });
  });

  describe("Withdraw Collateral", function () {
    it("Should allow users to withdraw collateral when no debt", async function () {
      // First repay any existing debt
      const [collateralBefore] = await lendingProtocol.getUserData(
        user1.address
      );

      // Withdraw
      await lendingProtocol.connect(user1).withdrawCollateral();

      // Check user data
      const [collateralAfter] = await lendingProtocol.getUserData(
        user1.address
      );
      expect(collateralAfter).to.equal(0);
    });

    it("Should reject withdrawal with outstanding debt", async function () {
      // User2 should still have debt from previous test
      await expect(
        lendingProtocol.connect(user2).withdrawCollateral()
      ).to.be.revertedWith("Cannot withdraw with outstanding debt");
    });
  });
});
