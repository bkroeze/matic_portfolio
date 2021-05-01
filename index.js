var { AaveService } = require('./src/services/AaveService');
const Aave = new AaveService(true, false);

Aave.getFormattedBalance('0xcccd8e327bf88bC793337E0270D368d814C3c165')
    .then((summary) => {
      console.log('-----------------------------------------');
      console.log(JSON.stringify(summary, null, 2));
    });

