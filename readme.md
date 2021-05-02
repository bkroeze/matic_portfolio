matic_portfolio
===================

Description
-----------
Scripts to help manage Aave/Curve investments.

Installation
------------

- Check out code
- Do `yarn install`
- run with `node index.js --help` to see options.
- export an environment variable "AAVE_ACCOUNT" to avoid having to enter your account all the time.
- export an environment variable "AAVE_IFTTT" with an IFTTT webhook key, or give it with --ifttt and a warning will trigger a push to a maker webhook with name "aave_health_alert", a value1 of the health, and a value2 of the threshold that triggered.

Examples
--------

- `node index.js balance --format=json`
  This will query Aave for your balances and give you them in JSON format.
