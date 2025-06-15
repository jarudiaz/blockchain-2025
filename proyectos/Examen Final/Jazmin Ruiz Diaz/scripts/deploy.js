const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Desplegando desde la cuenta:", deployer.address);

  // 1. Despliega CollateralToken
  const CollateralToken = await hre.ethers.getContractFactory(
    "CollateralToken"
  );
  const collateralToken = await CollateralToken.deploy();
  await collateralToken.deployed(); // Cambiado de waitForDeployment()
  console.log("CollateralToken desplegado en:", collateralToken.address);

  // 2. Despliega LoanToken
  const LoanToken = await hre.ethers.getContractFactory("LoanToken");
  const loanToken = await LoanToken.deploy();
  await loanToken.deployed();
  console.log("LoanToken desplegado en:", loanToken.address);

  // 3. Despliega LendingProtocol
  const LendingProtocol = await hre.ethers.getContractFactory(
    "LendingProtocol"
  );
  const lendingProtocol = await LendingProtocol.deploy(
    collateralToken.address,
    loanToken.address
  );
  await lendingProtocol.deployed();
  console.log("LendingProtocol desplegado en:", lendingProtocol.address);

  // 4. Mina tokens iniciales
  const mintTx1 = await loanToken.mint(
    lendingProtocol.address,
    ethers.utils.parseEther("10000")
  );
  await mintTx1.wait();

  const mintTx2 = await collateralToken.mint(
    deployer.address,
    ethers.utils.parseEther("1000")
  );
  await mintTx2.wait();

  console.log("Tokens minted exitosamente!");

  const testAccount = "0xe57cfd20331843d94bF759eA890b49490D3E8916";
  await collateralToken.mint(testAccount, ethers.utils.parseEther("1000"));
  await loanToken.mint(testAccount, ethers.utils.parseEther("1000"));

  // Actualiza automáticamente el .env
  const fs = require("fs");
  const envPath = ".env";
  let envFile = fs.readFileSync(envPath, "utf8");

  envFile = envFile.replace(
    /VITE_CONTRACT_ADDRESS=.*/,
    `VITE_CONTRACT_ADDRESS=${lendingProtocol.address}`
  );
  envFile = envFile.replace(
    /VITE_COLLATERAL_TOKEN_ADDRESS=.*/,
    `VITE_COLLATERAL_TOKEN_ADDRESS=${collateralToken.address}`
  );
  envFile = envFile.replace(
    /VITE_LOAN_TOKEN_ADDRESS=.*/,
    `VITE_LOAN_TOKEN_ADDRESS=${loanToken.address}`
  );

  fs.writeFileSync(envPath, envFile);
  console.log("Archivo .env actualizado con las nuevas direcciones");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
