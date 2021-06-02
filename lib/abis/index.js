const fs = require('fs');

const readJson = (path, cb) => {
  return new Promise((resolve, reject) => {
    fs.readFile(require.resolve(path), (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
};

module.exports = {
  getABI: (abi) => readJson(`./${abi}.json`)
};
