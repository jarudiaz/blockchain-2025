// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingProtocol is Ownable {
    IERC20 public collateralToken;
    IERC20 public loanToken;

    uint256 public constant INTEREST_RATE = 5; // 5% weekly
    uint256 public constant COLLATERAL_RATIO = 150; // 150%

    struct UserData {
        uint256 collateral;
        uint256 debt;
        uint256 lastInterestUpdate;
    }

    mapping(address => UserData) public users;

    constructor(address _collateralToken, address _loanToken) {
        collateralToken = IERC20(_collateralToken);
        loanToken = IERC20(_loanToken);
    }

    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        collateralToken.transferFrom(msg.sender, address(this), amount);
        users[msg.sender].collateral += amount;
    }

    function borrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        UserData storage user = users[msg.sender];
        require(user.collateral > 0, "No collateral deposited");

        // Calculate maximum borrow amount (66% of collateral)
        uint256 maxBorrow = (user.collateral * 100) / COLLATERAL_RATIO;
        require(amount <= maxBorrow, "Borrow amount exceeds collateral limit");

        // Update debt with accrued interest
        _updateInterest(msg.sender);

        user.debt += amount;
        loanToken.transfer(msg.sender, amount);
    }

    function repay() external {
        UserData storage user = users[msg.sender];
        require(user.debt > 0, "No debt to repay");

        _updateInterest(msg.sender);

        uint256 debt = user.debt;
        user.debt = 0;

        loanToken.transferFrom(msg.sender, address(this), debt);
    }

    function withdrawCollateral() external {
        UserData storage user = users[msg.sender];
        require(user.debt == 0, "Cannot withdraw with outstanding debt");
        require(user.collateral > 0, "No collateral to withdraw");

        uint256 collateral = user.collateral;
        user.collateral = 0;

        collateralToken.transfer(msg.sender, collateral);
    }

    function getUserData(
        address user
    )
        external
        view
        returns (uint256 collateral, uint256 debt, uint256 interest)
    {
        UserData memory data = users[user];
        uint256 currentDebt = data.debt;

        if (data.lastInterestUpdate > 0 && data.debt > 0) {
            // Simple interest calculation: debt * rate
            currentDebt += (data.debt * INTEREST_RATE) / 100;
        }

        return (data.collateral, currentDebt, INTEREST_RATE);
    }

    function _updateInterest(address user) private {
        UserData storage data = users[user];

        if (data.lastInterestUpdate > 0 && data.debt > 0) {
            // Apply simple interest
            data.debt += (data.debt * INTEREST_RATE) / 100;
        }

        data.lastInterestUpdate = block.timestamp;
    }
}
