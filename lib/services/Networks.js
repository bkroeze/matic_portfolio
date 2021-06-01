const ethers = require('ethers');
const R = require('ramda');

const NETWORKS = {
  polygon: {
    url: 'https://rpc-mainnet.maticvigil.com',
    chainId: 137,
    symbol: 'MATIC'
  }
};

const networkURL = (network) =>
  R.pathOr(null, [network.toLowerCase(), 'url'], NETWORKS);

const getProvider = (network) =>
  new ethers.providers.JsonRpcProvider(networkURL(network));

module.exports = {
  getProvider
};
