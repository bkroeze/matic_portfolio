const formatDate = require('date-fns/format');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const Table = require('cli-table');
const FarmingService = require('../services/FarmingService');
const R = require('ramda');

const YMDDate = (dt) => {
  try {
    return formatDate(dt, 'yyyy-MMM-dd HH:mm');
  } catch (e) {
    console.error(e);
    return dt;
  }
};

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

function trimDec (val, decimals) {
  let [whole, fraction] = (val + '').split('.');
  if (!fraction) {
    return val;
  }
  if (!whole) {
    whole = 0;
  }
  if (fraction.length > decimals) {
    fraction = fraction.slice(0, decimals);
  }
  return `${whole}.${fraction}`;
}

const trimmedVals = (pool, decimals) => {
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
    trimmed[key] = trimDec(pool[key], decimals);
  });
  return trimmed;
};

async function getFarmingCommand (args) {
  const {
    address,
    farm,
    matic,
    format,
    decimals,
    noheader,
    allpools,
    verbose
  } = args;

  if (!address) {
    throw new Error('Missing Address');
  }
  const Farms = new FarmingService(matic, verbose);
  const balances = await Farms.getBalances(farm, address, allpools);
  const timestamp = new Date().toISOString();
  
  const records = balances.map((pool) => ({
    timestamp,
    farm,
    poolname: getFarmName(pool),
    ...getHeaders(pool),
    ...trimmedVals(pool, decimals)
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
  - Invested: \$${trimDec(pool.stakeTotalUSD, decimals)}
  - Pending: ${pool.stakePendingReward} ${pool.rewardToken.toUpperCase()} (\$${trimDec(pool.stakeRewardPendingUSD, decimals)})
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

  return yargs
    .option('address',
      { alias: 'a', type: 'string', describe: 'Account address', default: defaultAccount })
    .option('farm',
      { default: 'ironfinance' })
    .option('network',
      { alias: 'n', default: 'polygon' })
    .option('decimals',
      { type: 'number', desc: 'number of decimals to display for totals', default: 4 })
    .option('format',
      { type: 'string', desc: 'json,csv,table,org', default: 'table' })
    .option('noheader',
      { type: 'boolean', describe: 'do not output header', default: false })
    .option('allpools',
      { type: 'boolean', describe: 'include all pools, not just staked', default: false })
    .option('verbose',
      { alias: 'v', type: 'boolean', default: false });
}

module.exports = {
  command: 'farming',
  desc: 'Get yield farming data',
  builder: farmingOptions,
  handler: getFarmingCommand
};
