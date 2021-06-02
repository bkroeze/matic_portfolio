const formatDate = require('date-fns/format');

/**
 * Builds the base commandline switches every command will want.
 */
function baseOptions (yargs) {
  return yargs
    .option('network',
      { alias: 'n', default: 'polygon' })
    .option('decimals',
            { type: 'number', desc: 'number of decimals to display for totals', default: 4 })
    .option('verbose',
      { alias: 'v', type: 'boolean', default: false });
}

/**
 * Simple, consistent date formatter
 */
const YMDDate = (dt) => {
  try {
    return formatDate(dt, 'yyyy-MMM-dd HH:mm');
  } catch (e) {
    console.error(e);
    return dt;
  }
};


function trimDec(val, decimals) {
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

/**
   Function Creator - returns a function that trims to `decimals` precision.
 */
function trimmerFactory (decimals) {
  return (val) => trimDec(val, decimals);
}

module.exports = {
  baseOptions,
  trimmerFactory,
  trimDec,
  YMDDate
};
