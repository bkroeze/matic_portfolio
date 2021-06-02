const yargs = require('yargs');
const aave = require('./lib/commands/aave');
const farming = require('./lib/commands/farming');

farming.setup(yargs);
aave.setup(yargs);
yargs
  .help()
  .parse();
