const { request } = require('graphql-request');
const { v2 } = require('@aave/protocol-js');

const allReservesQ = `{
  reserves {
    id
    underlyingAsset
    name
    symbol
    decimals
    isActive
    isFrozen
    usageAsCollateralEnabled
    borrowingEnabled
    stableBorrowRateEnabled
    baseLTVasCollateral
    optimalUtilisationRate
    averageStableRate
    stableRateSlope1
    stableRateSlope2
    baseVariableBorrowRate
    variableRateSlope1
    variableRateSlope2
    variableBorrowIndex
    variableBorrowRate
    totalScaledVariableDebt
    liquidityIndex
    reserveLiquidationThreshold
    aToken {
      id
    }
    vToken {
      id
    }
    sToken {
      id
    }
    availableLiquidity
    stableBorrowRate
    liquidityRate
    totalPrincipalStableDebt
    totalLiquidity
    utilizationRate
    reserveLiquidationBonus
    price {
      priceInEth
    }
    lastUpdateTimestamp
    stableDebtLastUpdateTimestamp
    reserveFactor
  }
}`;

const userReservesQ = (address) => `{
  userReserves(where: { user: "${address.toLowerCase()}"}) {
    scaledATokenBalance
    reserve {
      id
      underlyingAsset
      name
      symbol
      decimals
      liquidityRate
      reserveLiquidationBonus
      lastUpdateTimestamp
      aToken {
        id
      }
    }
    usageAsCollateralEnabledOnUser
    stableBorrowRate
    stableBorrowLastUpdateTimestamp
    principalStableDebt
    scaledVariableDebt
    variableBorrowIndex
    lastUpdateTimestamp
  }
}`;

const ethUSDPriceQ = `{
  priceOracle(id: "1") {
    usdPriceEth
  }
}`;

class AaveService {
  constructor (matic = true, verbose = false) {
    this.API = matic
      ? 'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic'
      : 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2';
    this.verbose = verbose;
  }

  getReserves () {
    return request(this.API, allReservesQ)
      .then((response) => {
        if (this.verbose) {
          console.log(`getReserves raw response:\n${JSON.stringify(response, null, 2)}`);
        }
        return response.reserves;
      });
  }

  getUserReserves (address) {
    return request(this.API, userReservesQ(address))
      .then((response) => {
        if (this.verbose) {
          console.log(`getUserReserves raw response:\n${JSON.stringify(response, null, 2)}`);
        }
        return response.userReserves;
      });
  }

  getEthPrice () {
    return request(this.API, ethUSDPriceQ)
      .then((response) => {
        if (this.verbose) {
          console.log(`getEthPrice raw response:\n${JSON.stringify(response, null, 2)}`);
        }

        return response.priceOracle.usdPriceEth;
      });
  }

  getFormattedBalance (address) {
    return Promise.all([
      this.getReserves(),
      this.getUserReserves(address),
      this.getEthPrice()
    ]).then(([reserves, userReserves, ethPrice]) => {
      return v2.formatUserSummaryData(
        reserves, userReserves, address, ethPrice, Math.floor(Date.now() / 1000));
    });
  }
}

module.exports = {
  AaveService
};
