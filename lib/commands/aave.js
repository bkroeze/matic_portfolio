const IFTTT = require('ifttt-webhooks-channel');
const Table = require('cli-table');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const { AaveService } = require('../services/AaveService');
const { YMDDate, trimmerFactory, baseOptions } = require('./common');

const getBalanceRecord = (symbol, balance, trimVal) => {
  const { currentLiquidationThreshold, healthFactor } = balance;
  const ltv = currentLiquidationThreshold / healthFactor;

  return {
    timestamp: (new Date()).toISOString(),
    symbol,
    liquidity: trimVal(balance[`totalLiquidity${symbol}`]),
    collateral: trimVal(balance[`totalCollateral${symbol}`]),
    borrows: trimVal(balance[`totalBorrows${symbol}`]),
    LTVMax: trimVal(balance.currentLoanToValue),
    LTV: trimVal(ltv + ''),
    health: trimVal(healthFactor)
  };
};

async function getBalanceCommand (args) {
  const {
    address,
    decimals,
    network,
    format,
    verbose,
    usd,
    eth,
    warn,
    noheader,
    ifttt
  } = args;

  if (!address) {
    throw new Error('Missing Address');
  }
  const Aave = new AaveService(network === 'polygon', verbose);
  const balance = await Aave.getFormattedBalance(address);
  const { currentLiquidationThreshold, healthFactor } = balance;
  const ltv = currentLiquidationThreshold / healthFactor;
  const trimVal = trimmerFactory(decimals);

  switch (format) {
    case 'table': {
      const table = new Table({
        head: [YMDDate(Date.now()), 'Coin', 'Amount']
      });

      if (usd) {
        table.push(['Liquidity', 'USD', trimVal(balance.totalLiquidityUSD)]);
        table.push(['Collateral', 'USD', trimVal(balance.totalCollateralUSD)]);
        table.push(['Borrows', 'USD', trimVal(balance.totalBorrowsUSD)]);
      }

      if (eth) {
        table.push(['Liquidity', 'ETH', trimVal(balance.totalLiquidityETH)]);
        table.push(['Collateral', 'ETH', trimVal(balance.totalCollateralETH)]);
        table.push(['Borrows', 'ETH', trimVal(balance.totalBorrowsETH)]);
      }
      table.push(['Loans', 'LTV max', trimVal(balance.currentLoanToValue)]);
      table.push(['', 'LTV', `${trimVal(ltv + '')}`]);
      table.push(['', 'Health', trimVal(healthFactor)]);

      console.log(table.toString());
      break;
    }
    case 'csv': {
      const csv = createCsvStringifier({
        header: ['timestamp', 'symbol', 'liquidity', 'collateral', 'borrows', 'LTVMax', 'LTV', 'health'].map(x => ({ id: x, title: x }))
      });
      const records = [];
      if (usd) {
        records.push(getBalanceRecord('USD', balance, trimVal));
      }
      if (eth) {
        records.push(getBalanceRecord('ETH', balance, trimVal));
      }
      if (!noheader) {
        console.log(csv.getHeaderString().slice(0, -1));
      }
      console.log(csv.stringifyRecords(records).slice(0, -1));
      break;
    }
    case 'org': {
      console.log(`* AAVE ${YMDDate(Date.now())}`);
      if (usd) {
        console.log(`  - Liquidity USD: ${trimVal(balance.totalLiquidityUSD)}
  - Collateral USD: ${trimVal(balance.totalCollateralUSD)}
  - Borrows USD: ${trimVal(balance.totalBorrowsUSD)}`);
      }
      if (eth) {
        console.log(`  - Liquidity ETH: ${trimVal(balance.totalLiquidityETH)}
  - Collateral ETH: ${trimVal(balance.totalCollateralETH)}
  - Borrows ETH: ${trimVal(balance.totalBorrowsETH)}`);
      }
      console.log(`  - LTV: ${trimVal(ltv + '')}
  - Health: ${trimVal(healthFactor)}`);
      break;
    }
    default: {
      console.log(JSON.stringify(balance, null, 2));
    }
  }
  if (warn && healthFactor < warn) {
    console.log('WARNING, health below threshold!');
    if (ifttt) {
      console.log('Sending to IFTTT');
      const channel = new IFTTT(ifttt);
      channel.post('aave_health_alert', [trimVal(healthFactor), warn]);
    }
  }
}

/**
 * Builds the commandline switches needed for the balance command
 */
function balanceOptions (yargs) {
  const defaultAccount = process.env.AAVE_ACCOUNT || '';
  const defaultIFTTT = process.env.AAVE_IFTTT || '';

  return baseOptions(yargs
    .option('address',
      { alias: 'a', type: 'string', describe: 'Account address', default: defaultAccount })
    .option('format',
      { type: 'string', desc: 'json,csv,table,org', default: 'table' })
    .option('noheader',
      { type: 'boolean', describe: 'do not output header', default: false })
    .option('usd',
      { type: 'boolean', desc: 'show USD values?', default: true })
    .option('eth',
      { type: 'boolean', desc: 'show ETH values?', default: false })
    .option('ifttt',
      { type: 'string', desc: 'IFTTT Key, if a warning should trigger an IFTTT action', default: defaultIFTTT })
    .option('warn',
      { type: 'number', desc: 'Warn at Health threshold under (default: off)', default: 0 }));
}

async function getRatesCommand (args) {
  const {
    // coin,
    // days,
    // hours,
    decimals,
    network,
    format,
    verbose
  } = args;

  // until I fix the history query
  const days = 1;
  const hours = false;
  const Aave = new AaveService(network === 'polygon', verbose);
  const rates = await Aave.getFormattedRates(Date.now(), days, hours);
  const trimVal = trimmerFactory(decimals);

  switch (format) {
    case 'table': {
      const table = new Table({
        head: ['Date', 'Coin', 'Deposit rate', 'Lend rate']
      });

      Object.keys(rates).forEach((timestamp) => {
        rates[timestamp].forEach((coinRate) => {
          table.push([
            timestamp,
            coinRate.symbol,
            trimVal(coinRate.liquidityRate),
            trimVal(coinRate.variableBorrowRate)
          ]);
        });
      });

      console.log(table.toString());
      break;
    }
    case 'csv': {
      const csv = createCsvStringifier({
        header: ['timestamp', 'symbol', 'liquidityRate', 'variableBorrowRate'].map(x => ({ id: x, title: x }))
      });

      const toCSVRow = (timestamp, row) => ({
        timestamp,
        symbol: row.symbol,
        liquidityRate: trimVal(row.liquidityRate),
        variableBorrowRate: trimVal(row.variableBorrowRate)
      });

      const records = [];
      Object.keys(rates).forEach((timestamp) => {
        rates[timestamp].forEach((coinRate) => {
          records.push(toCSVRow(timestamp, coinRate));
        });
      });
      if (!args.noheader) {
        console.log(csv.getHeaderString().slice(0, -1));
      }
      console.log(csv.stringifyRecords(records).slice(0, -1));
      break;
    }
    default: {
      console.log(JSON.stringify(rates, null, 2));
    }
  }
}

function rateOptions (yargs) {
  return baseOptions(yargs
    /* .option('days',
     *         { type: 'number', describe: 'How many days of data to retrieve', default: 30 })
     * .option('hours',
     *         { type: 'boolean', describe: 'Get hours instead of days', default: false }) */
    .option('noheader',
      { type: 'boolean', describe: 'do not output header', default: false })
    .option('format',
      { type: 'string', desc: 'json,table,csv', default: 'table' }));

  /* .option('coin',
   *         { type: 'string', describe: 'Asset name in Aave', default: 'weth' })); */
}

function setup(yargs) {
  return yargs
    .command({
    command: 'aave_balance',
    desc: 'Get Aave Balance',
    builder: balanceOptions,
    handler: getBalanceCommand
  })
  .command({
    command: 'aave_rates',
    desc: 'Get Aave historical rates',
    builder: rateOptions,
    handler: getRatesCommand
  });
}

module.exports = {
  setup
};
