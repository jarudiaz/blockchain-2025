// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendingProtocol
 * @dev Protocolo de prestamos descentralizado con colateral
 * @notice Permite depositar colateral y obtener prestamos con interes fijo del 5% semanal
 */
contract LendingProtocol is Ownable {
    IERC20 public collateralToken;
    IERC20 public loanToken;

    /// @dev Tasa de interes fija del 5% semanal (interes simple)
    uint256 public constant INTEREST_RATE = 5;

    /// @dev Ratio de colateralización del 150% (solo se puede pedir 66.67% del colateral)
    uint256 public constant COLLATERAL_RATIO = 150;

    /**
     * @dev Estructura para almacenar datos del usuario
     * @param collateral Cantidad de tokens colateral depositados
     * @param debt Deuda total actual
     * @param interestPeriods Contador de periodos de interes aplicados
     * @param lastInterestTimestamp Ultimo momento en que se aplico interes
     */
    struct UserData {
        uint256 collateral;
        uint256 debt;
        uint256 interestPeriods;
        uint256 lastInterestTimestamp;
    }

    mapping(address => UserData) public users;

    /**
     * @dev Constructor del contrato
     * @param _collateralToken Direccion del token usado como colateral
     * @param _loanToken Direccion del token usado para prestamos
     */
    constructor(address _collateralToken, address _loanToken) {
        collateralToken = IERC20(_collateralToken);
        loanToken = IERC20(_loanToken);
    }

    /**
     * @notice Deposita tokens colaterales en el protocolo
     * @dev El usuario debe aprobar previamente el monto al contrato
     * @param amount Cantidad de tokens a depositar
     */
    function depositCollateral(uint256 amount) external {
        require(amount > 0, "El monto debe ser mayor a 0");

        collateralToken.transferFrom(msg.sender, address(this), amount);
        users[msg.sender].collateral += amount;
    }

    /**
     * @notice Solicita un préstamo con colateral depositado
     * @dev Aplica interes si ya existia deuda previa
     * @param amount Cantidad de tokens a pedir prestado
     */
    function borrow(uint256 amount) external {
        require(amount > 0, "El monto debe ser mayor a 0");

        UserData storage user = users[msg.sender];
        require(user.collateral > 0, "No se ha depositado colateral");

        // Aplica interes si ya existia deuda
        if (user.debt > 0) {
            _applyInterest(msg.sender);
        }

        // Calcular prestamo maximo considerando deuda existente + interes
        uint256 maxBorrow = (user.collateral * 100) / COLLATERAL_RATIO;
        uint256 totalPotentialDebt = user.debt + amount;

        require(
            totalPotentialDebt <= maxBorrow,
            "El monto del prestamo excede el limite del colateral"
        );

        // Inicializa el timestamp si es la primera deuda
        if (user.lastInterestTimestamp == 0) {
            user.lastInterestTimestamp = block.timestamp;
        }

        // Actualizar la deuda ANTES de transferir
        user.debt += amount;
        loanToken.transfer(msg.sender, amount);
    }

    /**
     * @notice Paga la deuda completa del usuario (con interes aplicado)
     * @dev Resetea todos los contadores despues del pago
     */
    function repay() external {
        UserData storage user = users[msg.sender];
        require(user.debt > 0, "No existe deuda a pagar");

        _applyInterest(msg.sender);

        uint256 debt = user.debt;
        user.debt = 0;
        user.interestPeriods = 0;
        user.lastInterestTimestamp = 0;

        loanToken.transferFrom(msg.sender, address(this), debt);
    }

    /**
     * @notice Retira el colateral del usuario si no tiene deuda
     * @dev Solo se puede retirar si la deuda es cero
     */
    function withdrawCollateral() external {
        UserData storage user = users[msg.sender];
        require(
            user.debt == 0,
            "No se puede retirar el colateral con deuda existente"
        );
        require(user.collateral > 0, "No existe colateral a retirar");

        uint256 amount = user.collateral;
        user.collateral = 0;

        collateralToken.transfer(msg.sender, amount);
    }

    /**
     * @notice Devuelve los datos del usuario
     * @param userAddr Direccion del usuario
     * @return collateral Cantidad de colateral depositado
     * @return debt Deuda actual
     * @return interestRate Tasa de interes
     * @return periods Periodos de interes aplicados
     */
    function getUserData(
        address userAddr
    )
        external
        view
        returns (
            uint256 collateral,
            uint256 debt,
            uint256 interestRate,
            uint256 periods
        )
    {
        UserData memory user = users[userAddr];
        return (
            user.collateral,
            user.debt,
            INTEREST_RATE,
            user.interestPeriods
        );
    }

    /**
     * @dev Aplica interes simple basado en el tiempo transcurrido
     * @param userAddr Direccion del usuario
     */
    function _applyInterest(address userAddr) internal {
        UserData storage user = users[userAddr];

        // Verificar si hay timestamp valido
        if (user.lastInterestTimestamp == 0) return;

        // Verificar si hay deuda para aplicar interes
        if (user.debt == 0) return;

        uint256 timeElapsed = block.timestamp - user.lastInterestTimestamp;
        uint256 weeksPassed = timeElapsed / 1 weeks;

        if (weeksPassed > 0) {
            uint256 interest = (user.debt * INTEREST_RATE * weeksPassed) / 100;
            user.debt += interest;
            user.interestPeriods += weeksPassed;
            user.lastInterestTimestamp += weeksPassed * 1 weeks;
        }
    }

    /**
     * @dev Funcion de prueba para aplicar interes manualmente
     * @param userAddr Direccion del usuario
     */
    function testApplyInterest(address userAddr) external {
        _applyInterest(userAddr);
    }

    /**
     * @dev Funcion auxiliar para testing - permite establecer timestamp sin deuda
     * @param userAddr Direccion del usuario
     * @param timestamp Timestamp a establecer
     */
    function testSetTimestamp(address userAddr, uint256 timestamp) external {
        users[userAddr].lastInterestTimestamp = timestamp;
    }
}
