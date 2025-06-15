# DeFi Lending Protocol - Proyecto Final Blockchain 2025

## Descripción del Proyecto

DApp de préstamos descentralizados que permite a los usuarios depositar tokens como colateral y obtener préstamos con garantía, implementando un sistema de interés fijo del 5% semanal sin necesidad de oráculos externos.

## Funcionalidades Principales

- **Depósito de Colateral**: Los usuarios pueden depositar tokens cUSD como garantía
- **Préstamos Garantizados**: Solicitar préstamos en dDAI hasta el 66.67% del valor del colateral (ratio 150%)
- **Interés Fijo**: Sistema de interés simple del 5% semanal
- **Gestión de Deuda**: Pago completo de deuda con intereses acumulados
- **Retiro de Colateral**: Liberación del colateral una vez saldada la deuda

## Arquitectura del Sistema

### Contratos Inteligentes

#### 1. CollateralToken.sol (cUSD)

```solidity
- Token ERC20 estándar usando OpenZeppelin
- Función mint() restringida al owner
- Usado como garantía en el protocolo
```

#### 2. LoanToken.sol (dDAI)

```solidity
- Token ERC20 estándar usando OpenZeppelin
- Función mint() restringida al owner
- Token prestado a los usuarios
```

#### 3. LendingProtocol.sol

```solidity
- Contrato principal del protocolo
- Gestiona colateral, préstamos e intereses
- Implementa todas las funciones del negocio
```

### Funciones Principales

| Función                             | Descripción                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `depositCollateral(uint256 amount)` | Deposita tokens cUSD como colateral                  |
| `borrow(uint256 amount)`            | Solicita préstamo en dDAI (máx 66.67% del colateral) |
| `repay()`                           | Paga la deuda completa con intereses                 |
| `withdrawCollateral()`              | Retira colateral (solo si deuda = 0)                 |
| `getUserData(address user)`         | Consulta estado del usuario                          |

## Configuración Técnica

### Requisitos Previos

- Node.js >= 16.0.0
- npm >= 8.0.0
- MetaMask instalado
- Cuenta con ETH en Sepolia Testnet

### Instalación

# Instalar dependencias

npm install

# Configurar variables de entorno

```env
PRIVATE_KEY=tu_clave_privada_aqui
INFURA_API_KEY=tu_api_key_de_infura
VITE_CONTRACT_ADDRESS=0x494Af9FdB23532eDD6B2925a33345D96E6D3B1A6
VITE_COLLATERAL_TOKEN_ADDRESS=0x001893aa910283DC21697213bc9f3332b879aedC
VITE_LOAN_TOKEN_ADDRESS=0x326BB49d7532e20B66737444488BF461f5Da3204
VITE_RPC_URL=https://sepolia.infura.io/v3/tu_api_key
```

## Despliegue

### Despliegue en Sepolia

```bash
# Compilar contratos
npx hardhat compile

# Desplegar en Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

### Direcciones de Contratos (Sepolia)

- **CollateralToken (cUSD)**: `0x001893aa910283DC21697213bc9f3332b879aedC`
- **LoanToken (dDAI)**: `0x326BB49d7532e20B66737444488BF461f5Da3204`
- **LendingProtocol**: `0x494Af9FdB23532eDD6B2925a33345D96E6D3B1A6`

### Verificación en Etherscan

Los contratos pueden ser verificados en: https://sepolia.etherscan.io/

## Testing

### Ejecutar Tests

```bash
# Tests unitarios
npx hardhat test

# Cobertura de código
npx hardhat coverage
```

### Tests y Cobertura Alcanzada

```
LendingProtocol Full Coverage
    ✔ debería ejecutar el flujo completo de prestamos exitosamente (73ms)
    ✔ deberia probar todos los casos limite (137ms)
    ✔ deberia probar la funcionalidad de LoanToken
    ✔ deberia probar la funcionalidad de CollateralToken
    ✔ deberia probar el limite maximo de prestamo (42ms)
    ✔ deberia probar el calculo de intereses (71ms)
    ✔ deberia probar multiples periodos de interes (41ms)
    ✔ no deberia aplicar interes si no han pasado semanas
    ✔ deberia manejar el pago correctamente (52ms)
    ✔ deberia manejar prestamos con deuda existente (43ms)
    ✔ deberia probar _applyInterest con deuda cero
    ✔ deberia probar _applyInterest con timestamp cero
    ✔ deberia verificar el estado inicial despues del despliegue (70ms)
    ✔ deberia manejar el caso limite de ratio de colateral exacto
    ✔ deberia cubrir la rama debt==0 con timestamp!=0 para cobertura 100% (64ms)


  15 passing (21s)
```

```
----------------------|----------|----------|----------|----------|
File                  |  % Stmts | % Branch |  % Funcs |  % Lines |
----------------------|----------|----------|----------|----------|
contracts/            |      100 |      100 |      100 |      100 |
 CollateralToken.sol  |      100 |      100 |      100 |      100 |
 LendingProtocol.sol  |      100 |      100 |      100 |      100 |
 LoanToken.sol        |      100 |      100 |      100 |      100 |
----------------------|----------|----------|----------|----------|
All files             |      100 |      100 |      100 |      100 |
----------------------|----------|----------|----------|----------|
```

### Casos de Prueba Cubiertos

- Flujo completo de préstamos
- Validaciones de entrada (montos = 0)
- Límites de colateralización
- Cálculo de intereses simples
- Múltiples períodos de interés
- Manejo de errores y excepciones
- Funciones de solo propietario
- Estados edge cases y límites

## Frontend (Web App)

### Instalación y Ejecución

```bash
cd web_app
npm install
npm run dev
```

### Características de la Interfaz

- **Conexión MetaMask**: Integración completa con wallet
- **Dashboard del Usuario**: Visualización de colateral, deuda e intereses
- **Operaciones Interactivas**: Botones para todas las funciones del protocolo
- **Feedback en Tiempo Real**: Actualizaciones instantáneas del estado

### Configuración de MetaMask

```
Network Name: Sepolia Testnet
RPC URL: https://sepolia.infura.io/v3/YOUR_API_KEY
Chain ID: 11155111
Currency Symbol: ETH
```

## Lógica de Negocio

### Sistema de Colateralización

- **Ratio de Colateralización**: 150%
- **Préstamo Máximo**: 66.67% del valor del colateral
- **Relación de Precios**: 1 cUSD = 1 dDAI (fijo)

### Cálculo de Intereses

- **Tipo**: Interés simple
- **Tasa**: 5% semanal
- **Aplicación**: Basada en `block.timestamp`
- **Fórmula**: `interés = deuda × 0.05 × semanas_transcurridas`

### Ejemplo de Uso

```
1. Usuario deposita 150 cUSD como colateral
2. Puede pedir prestado hasta 100 dDAI (66.67%)
3. Después de 2 semanas, deuda = 100 + (100 × 0.05 × 2) = 110 dDAI
4. Usuario paga 110 dDAI y retira sus 150 cUSD
```

## Seguridad

### Medidas Implementadas

- **OpenZeppelin Contracts**: Uso de librerías auditadas
- **Validaciones de Entrada**: Verificación de montos y estados
- **Control de Acceso**: Modificador `onlyOwner` donde corresponde
- **Prevención de Reentrancy**: Patrón checks-effects-interactions
- **Manejo de Errores**: Mensajes descriptivos con `require()`

### Consideraciones de Gas

- **Uso de uint256**: Evita conversiones costosas
- **Minimización de Storage**: Estructura de datos optimizada
- **Batch Operations**: Agrupación de operaciones relacionadas

## Uso de la Aplicación

### Flujo de Usuario

1. **Conectar Wallet**: Conectar MetaMask a Sepolia
2. **Obtener Tokens**: Usar faucet o mint de prueba
3. **Depositar Colateral**: Aprobar y depositar cUSD
4. **Solicitar Préstamo**: Pedir hasta 66.67% en dDAI
5. **Gestionar Deuda**: Monitorear intereses acumulados
6. **Repagar**: Pagar deuda total con intereses
7. **Retirar**: Recuperar colateral depositado

### Interfaz de Usuario

- **Estado del Protocolo**: Visualización en tiempo real
- **Operaciones Disponibles**: Botones contextuales
- **Validaciones**: Prevención de operaciones inválidas
- **Feedback**: Notificaciones de éxito/error
