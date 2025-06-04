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
  });

  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  // Contract ABIs
  const lendingProtocolABI = [
    "function depositCollateral(uint256 amount)",
    "function borrow(uint256 amount)",
    "function repay()",
    "function withdrawCollateral()",
    "function getUserData(address user) view returns (uint256 collateral, uint256 debt, uint256 interest)",
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

  // Connect to MetaMask
  // En tu función connectWallet(), reemplaza con esto:
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

  // Load user data from contract
  const loadUserData = async () => {
    if (contract && account) {
      const [collateral, debt, interest] = await contract.getUserData(account);
      setUserData({
        collateral: ethers.utils.formatEther(collateral),
        debt: ethers.utils.formatEther(debt),
        interest: interest.toString(),
      });
    }
  };

  // Load token balances
  const loadTokenBalances = async () => {
    if (collateralToken && loanToken && account) {
      const collateralBal = await collateralToken.balanceOf(account);
      const loanBal = await loanToken.balanceOf(account);

      setCollateralBalance(ethers.utils.formatEther(collateralBal));
      setLoanBalance(ethers.utils.formatEther(loanBal));
    }
  };

  // Deposit collateral
  const deposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!collateralToken) {
      alert("Collateral token not initialized. Please reconnect wallet.");
      return;
    }

    try {
      const amount = ethers.utils.parseEther(depositAmount);

      // Verifica el saldo primero
      const balance = await collateralToken.balanceOf(account);
      if (balance.lt(amount)) {
        alert("Insufficient balance");
        return;
      }

      // Approve
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

      // Deposit
      const tx = await contract.depositCollateral(amount);
      await tx.wait();

      // Actualiza los datos
      await loadUserData();
      await loadTokenBalances();
      setDepositAmount("");

      alert("Deposit successful!");
    } catch (error) {
      console.error("Deposit failed:", error);
      alert("Deposit failed: " + (error.reason || error.message));
    }
  };

  // Borrow tokens
  const borrow = async () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      const amount = ethers.utils.parseEther(borrowAmount);
      const tx = await contract.borrow(amount);
      await tx.wait();

      await loadUserData();
      await loadTokenBalances();
      setBorrowAmount("");

      alert("Borrow successful!");
    } catch (error) {
      const reason = parseEthersError(error);
      alert("Borrow failed: " + reason);
    }
  };

  // Repay loan
  const repay = async () => {
    try {
      const debt = ethers.utils.parseEther(userData.debt);
      const allowance = await loanToken.allowance(account, contractAddress);

      if (allowance.lt(debt)) {
        const approveTx = await loanToken.approve(contractAddress, debt);
        await approveTx.wait();
      }

      const tx = await contract.repay();
      await tx.wait();

      await loadUserData();
      await loadTokenBalances();
      setRepayAmount("");

      alert("Repayment successful!");
    } catch (error) {
      const reason = parseEthersError(error);
      alert("Repayment failed: " + reason);
    }
  };

  // Withdraw collateral
  const withdraw = async () => {
    try {
      const tx = await contract.withdrawCollateral();
      await tx.wait();

      // Update balances
      loadUserData();
      loadTokenBalances();

      alert("Withdrawal successful!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      alert("Withdrawal failed: " + error.message);
    }
  };

  // Check if wallet is connected on page load
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
          <h2>Your Balances</h2>
          <p>cUSD (Collateral): {collateralBalance}</p>
          <p>dDAI (Loan): {loanBalance}</p>

          <h2>Your Position</h2>
          <p>Collateral Deposited: {userData.collateral} cUSD</p>
          <p>Current Debt: {userData.debt} dDAI</p>
          <p>Interest Rate: {userData.interest}% weekly</p>
        </div>

        <div className="actions">
          <div className="action-card">
            <h3>Deposit Collateral</h3>
            <input
              type="number"
              placeholder="Amount in cUSD"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <button onClick={deposit}>Deposit</button>
          </div>

          <div className="action-card">
            <h3>Borrow dDAI</h3>
            <p>
              Max borrow: {(parseFloat(userData.collateral) / 1.5).toFixed(2)}{" "}
              dDAI
            </p>
            <input
              type="number"
              placeholder="Amount in dDAI"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
            />
            <button onClick={borrow}>Borrow</button>
          </div>

          <div className="action-card">
            <h3>Repay Loan</h3>
            <p>Current debt: {userData.debt} dDAI</p>
            <button onClick={repay}>Repay Full Amount</button>
          </div>

          <div className="action-card">
            <h3>Withdraw Collateral</h3>
            <p>
              Available: {userData.debt === "0.0" ? userData.collateral : "0"}{" "}
              cUSD
            </p>
            <button onClick={withdraw} disabled={userData.debt !== "0.0"}>
              Withdraw
            </button>
          </div>
        </div>
      </main>

      <footer>
        <p>DeFi Lending Protocol - Blockchain Course 2025</p>
      </footer>
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

    return "Unknown error occurred.";
  }
}

export default App;
