const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingProtocol Full Coverage", function () {
  let owner, user1, user2;
  let collateralToken, loanToken, lendingProtocol;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Despliegue de contratos
    collateralToken = await (
      await ethers.getContractFactory("CollateralToken")
    ).deploy();
    loanToken = await (await ethers.getContractFactory("LoanToken")).deploy();
    lendingProtocol = await (
      await ethers.getContractFactory("LendingProtocol")
    ).deploy(collateralToken.address, loanToken.address);

    // Mint inicial - suficiente para todas las pruebas
    await collateralToken.mint(user1.address, ethers.utils.parseEther("2000"));
    await collateralToken.mint(user2.address, ethers.utils.parseEther("2000"));
    await loanToken.mint(
      lendingProtocol.address,
      ethers.utils.parseEther("50000")
    );
    await loanToken.mint(user1.address, ethers.utils.parseEther("5000"));
    await loanToken.mint(user2.address, ethers.utils.parseEther("5000"));
  });

  it("debería ejecutar el flujo completo de prestamos exitosamente", async function () {
    // 1. Depositar
    const depositAmount = ethers.utils.parseEther("150");
    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);

    // 2. Prestar (66% del colateral = 99)
    const borrowAmount = ethers.utils.parseEther("99");
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // 3. Aplicar interes - avanzar exactamente 1 semana
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // 4. Pagar con interes
    const [, currentDebt] = await lendingProtocol.getUserData(user1.address);
    await loanToken
      .connect(user1)
      .approve(lendingProtocol.address, currentDebt.mul(2));
    await lendingProtocol.connect(user1).repay();

    // 5. Retirar
    await lendingProtocol.connect(user1).withdrawCollateral();
  });

  it("deberia probar todos los casos limite", async function () {
    // probar deposito con 0
    await expect(
      lendingProtocol.connect(user1).depositCollateral(0)
    ).to.be.revertedWith("El monto debe ser mayor a 0");

    // probar prestar sin colateral (usar user2 que no ha depositado)
    await expect(lendingProtocol.connect(user2).borrow(1)).to.be.revertedWith(
      "No se ha depositado colateral"
    );

    // establecer user1 con colateral para los demas tests
    const collateralAmount = ethers.utils.parseEther("150");
    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, collateralAmount);
    await lendingProtocol.connect(user1).depositCollateral(collateralAmount);

    // probar prestar con monto 0
    await expect(lendingProtocol.connect(user1).borrow(0)).to.be.revertedWith(
      "El monto debe ser mayor a 0"
    );

    // probar pagar sin tener deuda (usar user2 que no tiene deuda)
    await expect(lendingProtocol.connect(user2).repay()).to.be.revertedWith(
      "No existe deuda a pagar"
    );

    // probar retirar sin colateral (usar user2 que no ha depositado)
    await expect(
      lendingProtocol.connect(user2).withdrawCollateral()
    ).to.be.revertedWith("No existe colateral a retirar");

    // probar retirar con deuda - user1 presta y trata de retirar
    await lendingProtocol.connect(user1).borrow(ethers.utils.parseEther("50"));
    await expect(
      lendingProtocol.connect(user1).withdrawCollateral()
    ).to.be.revertedWith(
      "No se puede retirar el colateral con deuda existente"
    );
  });

  it("deberia probar la funcionalidad de LoanToken", async function () {
    // probar hacer mint como el owner
    await loanToken.connect(owner).mint(user1.address, 100);

    // probar hacer mint como no owner
    await expect(
      loanToken.connect(user1).mint(user1.address, 100)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("deberia probar la funcionalidad de CollateralToken", async function () {
    // probar hacer mint como el owner
    await collateralToken.connect(owner).mint(user1.address, 100);

    // probar hacer min como no owner
    await expect(
      collateralToken.connect(user1).mint(user1.address, 100)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("deberia probar el limite maximo de prestamo", async function () {
    const collateralAmount = ethers.utils.parseEther("300");
    const maxBorrow = collateralAmount.mul(100).div(150); // 200

    // establecer nuevo usuario
    const [, , , freshUser] = await ethers.getSigners();
    await collateralToken.mint(freshUser.address, collateralAmount);

    // aprobar y depositar
    await collateralToken
      .connect(freshUser)
      .approve(lendingProtocol.address, collateralAmount);
    await lendingProtocol
      .connect(freshUser)
      .depositCollateral(collateralAmount);

    // Prestar el maximo permitido
    await lendingProtocol.connect(freshUser).borrow(maxBorrow);

    // Intentar pedir 1 wei extra (excede el limite)
    await expect(
      lendingProtocol.connect(freshUser).borrow(1)
    ).to.be.revertedWith(
      "El monto del prestamo excede el limite del colateral"
    );
  });

  it("deberia probar el calculo de intereses", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const borrowAmount = ethers.utils.parseEther("100");

    // Establecer
    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // Avanzar 1 semana
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Aplicar interes
    await lendingProtocol.testApplyInterest(user1.address);

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );

    // Verificar que se aplico 1 periodo de interes del 5%
    expect(periods).to.equal(1);
    expect(debt).to.equal(borrowAmount.mul(105).div(100)); // 105
  });

  it("deberia probar multiples periodos de interes", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const borrowAmount = ethers.utils.parseEther("100");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // Avanzar 2 semanas
    await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await lendingProtocol.testApplyInterest(user1.address);

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );

    expect(periods).to.equal(2);
    expect(debt).to.equal(borrowAmount.mul(110).div(100)); // 100 + 10% = 110
  });

  it("no deberia aplicar interes si no han pasado semanas", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const borrowAmount = ethers.utils.parseEther("100");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // Avanzar solo 1 dia (< 1 semana)
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await lendingProtocol.testApplyInterest(user1.address);

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );

    expect(periods).to.equal(0);
    expect(debt).to.equal(borrowAmount); // Sin cambios
  });

  it("deberia manejar el pago correctamente", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const borrowAmount = ethers.utils.parseEther("100");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // Avanzar tiempo para generar interes
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Aprobar y pagar deuda con interes
    const expectedDebt = borrowAmount.mul(105).div(100);
    await loanToken
      .connect(user1)
      .approve(lendingProtocol.address, expectedDebt);
    await lendingProtocol.connect(user1).repay();

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );

    expect(debt).to.equal(0);
    expect(periods).to.equal(0);
  });

  it("deberia manejar prestamos con deuda existente", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const firstBorrow = ethers.utils.parseEther("50");
    const secondBorrow = ethers.utils.parseEther("30");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);
    await lendingProtocol.connect(user1).borrow(firstBorrow);

    // Avanzar tiempo
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Segundo prestamo (deberia aplicar interes al primero)
    await lendingProtocol.connect(user1).borrow(secondBorrow);

    const [, debt] = await lendingProtocol.getUserData(user1.address);

    // Deuda esperada: (50 * 1.05) + 30 = 52.5 + 30 = 82.5
    const expectedDebt = firstBorrow.mul(105).div(100).add(secondBorrow);
    expect(debt).to.equal(expectedDebt);
  });

  it("deberia probar _applyInterest con deuda cero", async function () {
    const depositAmount = ethers.utils.parseEther("100");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);

    // Avanzar tiempo sin tener deuda
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Aplicar interes con deuda = 0 (deberia retornar sin hacer nada)
    await lendingProtocol.testApplyInterest(user1.address);

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );
    expect(debt).to.equal(0);
    expect(periods).to.equal(0);
  });

  it("deberia probar _applyInterest con timestamp cero", async function () {
    const depositAmount = ethers.utils.parseEther("100");

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);

    // Aplicar interes sin haber hecho borrow (timestamp = 0)
    await lendingProtocol.testApplyInterest(user1.address);

    const [, debt, , periods] = await lendingProtocol.getUserData(
      user1.address
    );
    expect(debt).to.equal(0);
    expect(periods).to.equal(0);
  });

  it("deberia verificar el estado inicial despues del despliegue", async function () {
    expect(await lendingProtocol.INTEREST_RATE()).to.equal(5);
    expect(await lendingProtocol.COLLATERAL_RATIO()).to.equal(150);
    expect(await lendingProtocol.collateralToken()).to.equal(
      collateralToken.address
    );
    expect(await lendingProtocol.loanToken()).to.equal(loanToken.address);
  });

  it("deberia manejar el caso limite de ratio de colateral exacto", async function () {
    const collateralAmount = ethers.utils.parseEther("150");
    const exactMaxBorrow = ethers.utils.parseEther("100"); // Exactamente 66.67%

    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, collateralAmount);
    await lendingProtocol.connect(user1).depositCollateral(collateralAmount);

    // Deberia ser exitoso con el maximo posible
    await lendingProtocol.connect(user1).borrow(exactMaxBorrow);

    const [, debt] = await lendingProtocol.getUserData(user1.address);
    expect(debt).to.equal(exactMaxBorrow);
  });

  it("deberia cubrir la rama debt==0 con timestamp!=0 para cobertura 100%", async function () {
    const depositAmount = ethers.utils.parseEther("300");
    const borrowAmount = ethers.utils.parseEther("100");

    // Setup inicial
    await collateralToken
      .connect(user1)
      .approve(lendingProtocol.address, depositAmount);
    await lendingProtocol.connect(user1).depositCollateral(depositAmount);

    // 1. Hacer prestamo para establecer timestamp
    await lendingProtocol.connect(user1).borrow(borrowAmount);

    // 2. Pagar inmediatamente (sin tiempo para interes)
    await loanToken
      .connect(user1)
      .approve(lendingProtocol.address, borrowAmount);
    await lendingProtocol.connect(user1).repay();

    // 3. Usar la funcion auxiliar para establecer timestamp sin deuda
    const futureTimestamp =
      (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await lendingProtocol.testSetTimestamp(user1.address, futureTimestamp);

    // 4. Aplicar interes - esto deberia ejecutar el branch debt==0 con timestamp!=0
    await lendingProtocol.testApplyInterest(user1.address);

    // Verificar que no cambio nada (porque debt == 0)
    const [, debt] = await lendingProtocol.getUserData(user1.address);
    expect(debt).to.equal(0);
  });
});
