const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const Table = require('cli-table');
const FarmingService = require('../services/FarmingService');
const { YMDDate, trimmerFactory, baseOptions } = require('./common');
const R = require('ramda');

const headerFields = [
  'farm',
  'poolname',
  'timestamp',
  'token0',
  'token1',
  'rewardToken',
  'single',
  'tvl',
  'lpTokenPrice',
  'lpStaked',
  'rewardPrice',
  'rewardPerBlock',
  'apr',
  'dailyPr',
  'stakeAmount',
  'stakeRewardDebt',
  'stakePendingReward',
  'stakeTotalUSD',
  'stakeRewardPendingUSD'
];

const getHeaders = R.pick(headerFields);

const getFarmName = (pool) => pool.single ? pool.token0.toUpperCase() : `${pool.token0.toUpperCase()}-${pool.token1.toUpperCase()}`;

const trimmedVals = (pool, trimVal) => {
  const trimmed = {};

  ['lpTokenPrice',
    'rewardPrice',
    'rewardPerBlock',
    'apr',
    'dailyPr',
    'stakeAmount',
    'stakeRewardDebt',
    'stakePendingReward',
    'stakeTotalUSD',
    'stakeRewardPendingUSD'
  ].forEach((key) => {
    trimmed[key] = trimVal(pool[key]);
  });
  return trimmed;
};

async function getFarmingCommand (args) {
  const {
    address,
    farm,
    network,
    format,
    decimals,
    noheader,
    allpools,
    verbose
  } = args;

  if (!address) {
    throw new Error('Missing Address');
  }
  const trimVal = trimmerFactory(decimals);
  const Farms = new FarmingService(network, verbose);
  const balances = await Farms.getBalances(farm, address, allpools);
  const timestamp = new Date().toISOString();
  
  const records = balances.map((pool) => ({
    timestamp,
    farm,
    poolname: getFarmName(pool),
    ...getHeaders(pool),
    ...trimmedVals(pool, trimVal)
  }));

  // const rv = R.map(
  //  R.props(['token0', 'token1', 'rewardToken', 'rewardPrice', 'lpTokenPrice']),
  //  balances.data.pools);
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(balances, null, 2));
      break;
    }
    case 'csv': {
      const csv = createCsvStringifier({
        header: headerFields.map(x => ({ id: x, title: x }))
      });
      if (!noheader) {
        console.log(csv.getHeaderString().slice(0, -1));
      }
      console.log(csv.stringifyRecords(records).slice(0, -1));
      break;
    }
    case 'table': {
      const table = new Table({
        head: [YMDDate(Date.now()), 'Invested', 'daily PR', 'Pending', 'Pending USD']});
        records.forEach((pool) => {
          table.push([
            getFarmName(pool),
            pool.stakeTotalUSD,
            pool.dailyPr,
            `${pool.stakePendingReward} ${pool.rewardToken.toUpperCase()}`,
            `\$${pool.stakeRewardPendingUSD}`
          ]);
        });
      console.log(table.toString());
      break;
    }
    case 'org': {
      console.log(`* ${farm} ${YMDDate(Date.now())}`);
      records.forEach((pool) => {
        console.log(`** Pool: ${getFarmName(pool)}
  - Invested: \$${trimVal(pool.stakeTotalUSD)}
  - Pending: ${pool.stakePendingReward} ${pool.rewardToken.toUpperCase()} (\$${pool.stakeRewardPendingUSD} @ ${pool.rewardPrice})
  - DailyPR: ${pool.dailyPr}\%`);
      });
      break;
    }
  }
}

function farmingOptions (yargs) {
  const defaultAccount = process.env.FARMING_ACCOUNT ||
                         process.env.AAVE_ACCOUNT ||
                         '';
  return baseOptions(
    yargs
      .option('address',
              { alias: 'a', type: 'string', describe: 'Account address', default: defaultAccount })
      .option('farm',
              { default: 'ironfinance' })
      .option('allpools',
              { type: 'boolean', describe: 'include all pools, not just staked', default: false })
      .option('format',
              { type: 'string', desc: 'json,csv,table,org', default: 'table' })
      .option('noheader',
              { type: 'boolean', describe: 'do not output header', default: false })
  );
}

function setup(yargs) {
  return yargs
    .command({
      command: 'farming',
      desc: 'Get yield farming data',
      builder: farmingOptions,
      handler: getFarmingCommand
    });
}

module.exports = {
  setup
};
