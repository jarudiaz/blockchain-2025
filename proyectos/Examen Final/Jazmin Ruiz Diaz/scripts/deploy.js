const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Desplegando desde la cuenta:", deployer.address);

  // 1. Despliega CollateralToken
  const CollateralToken = await hre.ethers.getContractFactory(
    "CollateralToken"
  );
  const collateralToken = await CollateralToken.deploy();
  await collateralToken.waitForDeployment();
  const collateralTokenAddress = await collateralToken.getAddress();
  console.log("CollateralToken desplegado en:", collateralTokenAddress);

  // 2. Despliega LoanToken
  const LoanToken = await hre.ethers.getContractFactory("LoanToken");
  const loanToken = await LoanToken.deploy();
  await loanToken.waitForDeployment();
  const loanTokenAddress = await loanToken.getAddress();
  console.log("LoanToken desplegado en:", loanTokenAddress);

  // 3. Despliega LendingProtocol
  const LendingProtocol = await hre.ethers.getContractFactory(
    "LendingProtocol"
  );
  const lendingProtocol = await LendingProtocol.deploy(
    collateralTokenAddress,
    loanTokenAddress
  );
  await lendingProtocol.waitForDeployment();
  const lendingProtocolAddress = await lendingProtocol.getAddress();
  console.log("LendingProtocol desplegado en:", lendingProtocolAddress);

  // 4. Mina tokens iniciales
  const mintTx1 = await loanToken.mint(
    lendingProtocolAddress,
    hre.ethers.parseEther("10000")
  );
  await mintTx1.wait();

  const mintTx2 = await collateralToken.mint(
    deployer.address,
    hre.ethers.parseEther("1000")
  );
  await mintTx2.wait();

  console.log("Tokens minted exitosamente!");

  const testAccount = "0xe57cfd20331843d94bF759eA890b49490D3E8916";
  await collateralToken.mint(testAccount, hre.ethers.parseEther("1000"));
  await loanToken.mint(testAccount, hre.ethers.parseEther("1000"));

  // Actualiza automáticamente el .env (opcional)
  const fs = require("fs");
  const envPath = ".env";
  let envFile = fs.readFileSync(envPath, "utf8");

  envFile = envFile.replace(
    /VITE_CONTRACT_ADDRESS=.*/,
    `VITE_CONTRACT_ADDRESS=${lendingProtocolAddress}`
  );
  envFile = envFile.replace(
    /VITE_COLLATERAL_TOKEN_ADDRESS=.*/,
    `VITE_COLLATERAL_TOKEN_ADDRESS=${collateralTokenAddress}`
  );
  envFile = envFile.replace(
    /VITE_LOAN_TOKEN_ADDRESS=.*/,
    `VITE_LOAN_TOKEN_ADDRESS=${loanTokenAddress}`
  );

  fs.writeFileSync(envPath, envFile);
  console.log("Archivo .env actualizado con las nuevas direcciones");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
