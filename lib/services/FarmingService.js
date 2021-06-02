const Axios = require('axios');
const R = require('ramda');
const Promise = require('bluebird');
const ethers = require('ethers');
const { getProvider } = require('./Networks');
const { getABI } = require('../abis');

// See Examples dir for api results

const FARMS = {
  polygon: {
    ironfinance: {
      api: 'https://api.iron.finance/farms?network=polygon'
    }
  }
};

let MasterChefABI;

getABI('MasterChef').then((abi) => {
  MasterChefABI = abi;
});

const unitValue = val => ethers.utils.formatUnits(val, 'ether');

function mergeAndEnhancePool (pool, balance) {
  const enhanced = {
    ...pool,
    ...balance,
    lpStaked: unitValue(pool.lpStaked)
  };
  const tokenPrice = parseFloat(enhanced.lpTokenPrice, 10);
  const stake = parseFloat(enhanced.stakeAmount, 10);
  const rewardPrice = parseFloat(enhanced.rewardPrice, 10);
  const rewardPending = parseFloat(enhanced.stakePendingReward, 10);
  enhanced.stakeTotalUSD = stake * tokenPrice;
  enhanced.stakeRewardPendingUSD = rewardPrice * rewardPending;

  return enhanced;
}

class FarmingService {
  constructor (network = 'polygon', verbose = false) {
    if (!FARMS[network]) {
      throw new Error(`No such network: ${network}`);
    }
    if (verbose) {
      console.log(`Using network: ${network}`);
    }
    this.farms = FARMS[network];
    this.network = network;
    this.verbose = verbose;
    this.provider = getProvider(network);
  }

  async getPools (farm) {
    const info = this.farms[farm];
    if (!info) {
      throw new Error('No such farm', farm);
    }
    return Axios({
      method: 'get',
      url: info.api
    });
  }

  async getBalances (farm, address, allpools) {
    const response = await this.getPools(farm);
    const pools = R.pathOr(null, ['data', 'pools'], response);
    if (!pools) {
      throw new Error('NO API RESPONSE');
    }
    // get User balances for all
    return Promise.all(
      pools.map(pool => this.getBalanceForPool(pool, address))
    ).then((balances) => {
      const poolBalances = [];
      for (let i = 0; i < pools.length; i++) {
        if (allpools || balances[i].stakeAmount != 0) {
          const enhancedPool = mergeAndEnhancePool(pools[i], balances[i]);
          poolBalances.push(enhancedPool);
        }
      }
      return poolBalances;
    });
  }

  async getBalanceForPool (pool, address) {
    const contract = new ethers.Contract(
      pool.masterChef,
      MasterChefABI,
      this.provider);
    const [amount, rewardDebt] = await contract
      .functions
      .userInfo(pool.id, address);

    const [pendingRewards] = await contract
      .functions
      .pendingReward(pool.id, address);

    return {
      stakeAmount: unitValue(amount),
      stakeRewardDebt: unitValue(rewardDebt),
      stakePendingReward: unitValue(pendingRewards)
    };
  }
}

module.exports = FarmingService;
