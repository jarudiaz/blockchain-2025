import { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./styles.css";

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [collateralToken, setCollateralToken] = useState(null);
  const [loanToken, setLoanToken] = useState(null);

  const [collateralBalance, setCollateralBalance] = useState("0");
  const [loanBalance, setLoanBalance] = useState("0");
  const [userData, setUserData] = useState({
    collateral: "0",
    debt: "0",
    interest: "0",
    periods: "0",
  });

  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [contractAddress, setContractAddress] = useState("");

  // Contract ABIs
  const lendingProtocolABI = [
    "function depositCollateral(uint256 amount)",
    "function borrow(uint256 amount)",
    "function repay()",
    "function withdrawCollateral()",
    "function getUserData(address user) view returns (uint256 collateral, uint256 debt, uint256 interestRate, uint256 periods)",
    "function collateralToken() view returns (address)",
    "function loanToken() view returns (address)",
  ];

  const erc20ABI = [
    // ERC20 Standard
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
    // Mintable
    "function mint(address to, uint256 amount)",
  ];

  // Conectar a Metamask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("¡Instala MetaMask!");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      setProvider(provider);
      setSigner(signer);

      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      setContractAddress(contractAddress); // <-- guarda la dirección para usar globalmente

      const collateralTokenAddress = import.meta.env
        .VITE_COLLATERAL_TOKEN_ADDRESS;
      const loanTokenAddress = import.meta.env.VITE_LOAN_TOKEN_ADDRESS;

      const lendingContract = new ethers.Contract(
        contractAddress,
        lendingProtocolABI,
        signer
      );
      const collateralTokenContract = new ethers.Contract(
        collateralTokenAddress,
        erc20ABI,
        signer
      );
      const loanTokenContract = new ethers.Contract(
        loanTokenAddress,
        erc20ABI,
        signer
      );

      setContract(lendingContract);
      setCollateralToken(collateralTokenContract);
      setLoanToken(loanTokenContract);

      return { lendingContract, collateralTokenContract, loanTokenContract };
    } catch (error) {
      console.error("Error:", error);
      alert("Error al conectar: " + error.message);
    }
  };

  // Cargar datos de usuario del contrato
  const loadUserData = async () => {
    if (contract && account) {
      const [collateral, debt, interest, periods] = await contract.getUserData(
        account
      );
      setUserData({
        collateral: ethers.utils.formatEther(collateral),
        debt: ethers.utils.formatEther(debt),
        interest: interest.toString(),
        periods: periods.toString(),
      });
    }
  };

  // Crgar balance de tokens
  const loadTokenBalances = async () => {
    if (collateralToken && loanToken && account) {
      const collateralBal = await collateralToken.balanceOf(account);
      const loanBal = await loanToken.balanceOf(account);

      setCollateralBalance(ethers.utils.formatEther(collateralBal));
      setLoanBalance(ethers.utils.formatEther(loanBal));
    }
  };

  // Depositar colateral
  const deposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert("Por favor ingrese un monto valido");
      return;
    }

    if (!collateralToken) {
      alert("Token colateral no inicializado. Por favor reconecte billetera.");
      return;
    }

    try {
      const amount = ethers.utils.parseEther(depositAmount);

      // Verifica el saldo primero
      const balance = await collateralToken.balanceOf(account);
      if (balance.lt(amount)) {
        alert("Saldo insuficiente");
        return;
      }

      // Aprobar
      const allowance = await collateralToken.allowance(
        account,
        contract.address
      );
      if (allowance.lt(amount)) {
        const approveTx = await collateralToken.approve(
          contract.address,
          amount
        );
        await approveTx.wait();
      }

      // Depositar
      const tx = await contract.depositCollateral(amount);
      await tx.wait();

      // Actualiza los datos
      await loadUserData();
      await loadTokenBalances();
      setDepositAmount("");

      alert("Deposito exitoso!");
    } catch (error) {
      console.error("Fallo de deposito:", error);
      alert("Fallo de deposito: " + (error.reason || error.message));
    }
  };

  // Prestar tokens
  const borrow = async () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      alert("Por favor ingrese un monto valido");
      return;
    }

    try {
      const amount = ethers.utils.parseEther(borrowAmount);
      const tx = await contract.borrow(amount);
      await tx.wait();

      await loadUserData();
      await loadTokenBalances();
      setBorrowAmount("");

      alert("Prestamo exitoso!");
    } catch (error) {
      const reason = parseEthersError(error);
      alert("Fallo de prestamo : " + reason);
    }
  };

  // Pagar deuda
  const repay = async () => {
    try {
      const [, rawDebt] = await contract.getUserData(account);

      // Añadir un 5% por interes que el contrato aplicara
      const debtWithInterest = rawDebt.mul(105).div(100);

      const allowance = await loanToken.allowance(account, contractAddress);

      if (allowance.lt(debtWithInterest)) {
        const approveTx = await loanToken.approve(
          contractAddress,
          debtWithInterest
        );
        await approveTx.wait();
      }

      const tx = await contract.repay();
      await tx.wait();

      await loadUserData();
      await loadTokenBalances();
      setRepayAmount("");

      alert("Pago exitoso!");
    } catch (error) {
      console.error("Fallo de pago:", error);
      const reason = parseEthersError(error);
      alert("Fallo de pago: " + reason);
    }
  };

  // Retirar colateral
  const withdraw = async () => {
    try {
      const tx = await contract.withdrawCollateral();
      await tx.wait();

      // Actualizar saldo
      loadUserData();
      loadTokenBalances();

      alert("Retiro exitoso!");
    } catch (error) {
      console.error("Falla de retiro:", error);
      alert("Falla de retiro: " + error.message);
    }
  };

  // Verificar si la billetera esta conectada al cargar la pagina
  useEffect(() => {
    const init = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        await connectWallet();
      }
    };
    init();
  }, []);

  // Cargar datos cuando todo esté inicializado
  useEffect(() => {
    if (contract && collateralToken && loanToken && account) {
      loadUserData();
      loadTokenBalances();
    }
  }, [contract, collateralToken, loanToken, account]);

  return (
    <div className="app">
      <header>
        <h1>DeFi Lending Protocol</h1>
        {!account ? (
          <button onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <div className="wallet-info">
            <span>
              Connected:{" "}
              {`${account.substring(0, 6)}...${account.substring(
                account.length - 4
              )}`}
            </span>
          </div>
        )}
      </header>

      <main>
        <div className="balances">
          <h2>Su Saldo</h2>
          <p>cUSD (Collateral): {collateralBalance}</p>
          <p>dDAI (Loan): {loanBalance}</p>

          <h2>Su Posicion</h2>
          <p>Colateral Depositado: {userData.collateral} cUSD</p>
          <p>Deuda Actual: {userData.debt} dDAI</p>
          <p>Tasa de Interes: {userData.interest}% weekly</p>
          <p>Semanas transcurridas con interes: {userData.periods}</p>
        </div>

        <div className="actions">
          <div className="action-card">
            <h3>Deposito de Colateral</h3>
            <input
              type="number"
              placeholder="Monto en cUSD"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <button onClick={deposit}>Depositar</button>
          </div>

          <div className="action-card">
            <h3>Prestamo dDAI</h3>
            <p>
              Max prestamo:{" "}
              {Math.floor(
                ((parseFloat(userData.collateral) * 100) / 150 -
                  parseFloat(userData.debt)) *
                  100
              ) / 100}{" "}
              dDAI
            </p>

            <input
              type="number"
              placeholder="Monto en dDAI"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
            />
            <button onClick={borrow}>Prestar</button>
          </div>

          <div className="action-card">
            <h3>Pagar Prestamos</h3>
            <p>Deuda actual: {userData.debt} dDAI</p>
            <button onClick={repay}>Pagar monto total de deuda</button>
          </div>

          <div className="action-card">
            <h3>Retirar Colateral</h3>
            <p>
              Disponible: {userData.debt === "0.0" ? userData.collateral : "0"}{" "}
              cUSD
            </p>
            <button onClick={withdraw} disabled={userData.debt !== "0.0"}>
              Retirar
            </button>
          </div>
        </div>
      </main>
    </div>
  );

  function parseEthersError(error) {
    if (error.reason) return error.reason;

    try {
      const json = JSON.parse(JSON.stringify(error));
      if (json.error && json.error.message) {
        const message = json.error.message;
        const match = message.match(/execution reverted: (.*)/);
        if (match && match[1]) return match[1];
      }
    } catch (e) {
      // fallback
    }

    return "Ocurrio un error desconocido.";
  }
}

export default App;
