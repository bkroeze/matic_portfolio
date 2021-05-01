var { request } = require("graphql-request");
var { v1, v2 } = require('@aave/protocol-js');

const collateralReservesQ = `{
  reserves (where: {
    usageAsCollateralEnabled: true
  }) {
    id
    name
    price {
      id
    }
    liquidityRate
    variableBorrowRate
    stableBorrowRate
  }
}`;

const allReservesQ = `{
  reserves {
    id
    name
    price {
      id
    }
    liquidityRate
    variableBorrowRate
    stableBorrowRate
  }
}`;

const userReservesQ = (address) => `{
  userReserves(where: { user: "${address.toLowerCase()}"}) {
    id
    reserve{
      id
      symbol
    }
    user {
      id
    }
  }
}`;

const ethUSDPriceQ = `{
  priceOracle(id: "1") {
    usdPriceEth
  }
}`;



class AaveService {
  constructor(matic = true, verbose = false) {
    this.API = matic ?
               'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic' :
               'https://api.thegraph.com/subgraphs/name/aave/protocol-v2';
    this.verbose = verbose;
  }

  getReserves() {
    return request(this.API, allReservesQ)
      .then((response) => {
        if (this.verbose) {
          console.log(`getReserves raw response:\n${JSON.stringify(response, null, 2)}`);
        }
        return response.reserves;
      });
  }

  getUserReserves(address) {
    return request(this.API, userReservesQ(address))
      .then((response) => {
        if (this.verbose) {
          console.log(`getUserReserves raw response:\n${JSON.stringify(response, null, 2)}`);
        }
        return response.userReserves;
      });
  }

  getEthPrice() {
    return request(this.API, ethUSDPriceQ)
      .then((response) => {
        if (this.verbose) {
          console.log(`getEthPrice raw response:\n${JSON.stringify(response, null, 2)}`);
        }

        return response.priceOracle.usdPriceEth;
      });
  }

  getFormattedBalance(address) {
    return Promise.all([
      this.getReserves(),
      this.getUserReserves(address),
      this.getEthPrice()
    ]).then(([reserves, userReserves, ethPrice]) => {
      /* console.log(JSON.stringify(reserves, null, 2));
       * console.log(JSON.stringify(userReserves, null, 2));
       * console.log(JSON.stringify(ethPrice, null, 2)); */
      return v2.formatUserSummaryData(
        reserves, userReserves, address, ethPrice, Math.floor(Date.now()/1000))
    });
  }
}

module.exports = {
  AaveService,
};
