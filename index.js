const IFTTT = require('ifttt-webhooks-channel')
const { evolve } = require('ramda');
const formatDate = require('date-fns/format');
const yargs = require('yargs');
const Table = require('cli-table');
const { AaveService } = require('./lib/services/AaveService');

const YMDDate = (dt) => {
  try {
    return formatDate(dt, 'yyyy-MMM-dd HH:MM');
  } catch (e) {
    console.error(e);
    return dt;
  }
}

function trimDec(val, decimals) {
  let [whole, fraction] = val.split('.');
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


/**
 * Builds the base commandline switches every command will want.
 */
function baseOptions (yargs) {
  return yargs
    .option('matic',
            { alias: 'm', type: 'boolean', default: true })
    .option('decimals',
            { type: 'number', desc: 'number of decimals to display for totals', default: 4})
    .option('verbose',
            { alias: 'v', type: 'boolean', default: false });
  
}

async function getBalanceCommand (args) {
  const {
    address,
    decimals,
    matic,
    format,
    verbose,
    usd,
    warn,
    ifttt
  } = args;

  if (!address) {
    throw('Missing Address');
  }
  const Aave = new AaveService(matic, verbose);
  const balance = await Aave.getFormattedBalance(address);
  const { currentLiquidationThreshold, healthFactor } = balance;
  const ltv = currentLiquidationThreshold / healthFactor;
    
  switch (format) {
    case 'table': {      
      const table = new Table({
        head: [YMDDate(Date.now()), "Coin", "Amount"]
      });

      if (usd) {
        table.push(["Liquidity", "USD", trimDec(balance.totalLiquidityUSD, decimals)]);
        table.push(["Collateral", "USD", trimDec(balance.totalCollateralUSD, decimals)]);
        table.push(["Borrows", "USD", trimDec(balance.totalBorrowsUSD, decimals)]);
      } else {
        table.push(["Liquidity", "ETH", trimDec(balance.totalLiquidityETH, decimals)]);
        table.push(["Collateral", "ETH", trimDec(balance.totalCollateralETH, decimals)]);
        table.push(["Borrows", "ETH", trimDec(balance.totalBorrowsETH, decimals)]);
      }
      table.push(["Loans", "LTV max", trimDec(balance.currentLoanToValue, decimals)]);
      table.push(["", "LTV", `${trimDec(ltv + "", decimals)}`]);
      table.push(["", "Health", trimDec(healthFactor, decimals)]);
      
      console.log(table.toString());
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
      channel.post('aave_health_alert', [trimDec(healthFactor), warn] );
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
            { type: 'string', desc: 'json,table', default: 'table' })
    .option('usd',
            { type: 'boolean', desc: 'show values in USD? (otherwise ETH)', default: true })
    .option('ifttt',
            { type: 'string', desc: 'IFTTT Key, if a warning should trigger an IFTTT action', default: defaultIFTTT})
    .option('warn',
            { type: 'number', desc: 'Warn at Health threshold under (default: off)', default: 0}));
}

async function getRatesCommand (args) {
    const {
      // coin,
      days,
      decimals,
      matic,
      format,
      verbose
    } = args;

  const Aave = new AaveService(matic, verbose);
  const rates = await Aave.getFormattedRates(Date.now(), days);

  switch (format) {
    case 'table': {
      const table = new Table({
        head: ["Date", "Coin", "Deposit rate", "Lend rate"]
      });
      
      Object.keys(rates).forEach((timestamp) => {
        const dateLabel =  YMDDate(timestamp);
        rates[timestamp].forEach((coinRate) => {
          table.push([
            dateLabel,
            coinRate.symbol,
            trimDec(coinRate.liquidityRate, decimals),
            trimDec(coinRate.variableBorrowRate, decimals)
          ]);
        });
      });
      
      console.log(table.toString());
      break;
    }
    case 'csv': {
      
      break;
    }
    default: {
      console.log(JSON.stringify(rates, null, 2));
    }
  }
}

function rateOptions (yargs) {
  return baseOptions(yargs
    .option('days',
            { type: 'number', describe: 'How many days of data to retrieve', default: 30 })
        .option('format',
                { type: 'string', desc: 'json,table,csv', default: 'table' }));

  /* .option('coin',
   *         { type: 'string', describe: 'Asset name in Aave', default: 'weth' })); */
}

yargs
  .command({
    command: 'balance',
    desc: 'Get Aave Balance',
    builder: balanceOptions,
    handler: getBalanceCommand
  })
  .command({
    command: 'rates',
    desc: 'Get Aave historical rates',
    builder: rateOptions,
    handler: getRatesCommand
  })
  .help()
  .parse();
