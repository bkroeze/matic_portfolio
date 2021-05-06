const { request } = require('graphql-request');
const { v2 } = require('@aave/protocol-js');
const fromUnixTime = require('date-fns/fromUnixTime');
const getUnixTime = require('date-fns/getUnixTime');
const addDays = require('date-fns/addDays');
const addHours = require('date-fns/addHours');
const Promise = require('bluebird');
const { range } = require('ramda');

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

const POOLS = {
  AMM: "0xacc030ef66f9dfeae9cbb0cd1b25654b82cfa8d5",
  V2: "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5"
}

//   reserves(where: {pool: "${POOLS[pool]}"}) {

const ratesQ = (timestamp, pool = "V2", count = 1) => `{
  reserves {
    id
    symbol
    paramsHistory(where: {timestamp_lte: ${timestamp}}, first: ${count},  orderBy: timestamp, orderDirection: desc) {
      variableBorrowIndex
      liquidityIndex
      priceInEth
      priceInUsd
      timestamp
    }
  }
}`;

const enrichRate = (raw) => ({
  ...raw,
  timestamp: fromUnixTime(raw.lastUpdateTimestamp).toISOString(),
});

class AaveService {
  constructor (matic = true, verbose = false) {
    this.API = matic
      ? 'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic'
      : 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2';
    this.verbose = verbose;
  }

  getHistoricalRatesAtTime(startDate, pool = "V2") {
    return request(this.API, ratesQ(getUnixTime(startDate), pool))
      .then(response => response.reserves)
  }
  
  getHistoricalRates(reserves, startDate, days, hours = false, pool = "V2") {
    const addFunc = hours ? addHours : addDays;
    const daysList = range(0, hours ? days * 24 : days).map(delta => addFunc(startDate, delta));
    const getRates = (day) => this.getHistoricalRatesAtTime(day, pool);

    return Promise
      .map(daysList, getRates, { concurrency: 5 })
      .tap((dayRates) => {
        if (this.verbose) {
          console.log(`getHistoricalRates days:\n${JSON.stringify(dayRates, null, 2)}`);
        }
      })
      .then((dayRates) => {
        const rates = {};
        daysList.forEach((day, i) => {
          rates[day.toISOString()] = v2.formatReserves(reserves, dayRates[i]);
        });
        return rates;
      });
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

  getFormattedRates(startDate, days, hours = false, pool="V2") {
    return this.getReserves()
        .then((reserves) => {
          return this.getHistoricalRates(reserves, startDate, days, hours, pool);
       });
  }

}

module.exports = {
  AaveService
};
