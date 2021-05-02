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
- export an environment variable "AAVE_IFTTT" with an IFTTT webhook key, or give it with --ifttt and a warning will trigger a push to a maker webhook.

IFTTT
-----
If you want an alert, this script will call IFTTT via a "maker webhook". Go to IFTTT, and make a new Applet, naming the event exactly "aave_health_alert". The script will send an alert there, with a value1 of the current health, and a value2 of the triggering threshold.

I set my notification to be ""{{EventName}}" was "{{Value1}}" with threshold = "{{Value2}}" at {{OccurredAt}}", and I have it send a notification to the IFTTT app.

That way, I get a message on my phone if the alert goes off, via the IFTTT app installed on it.

Examples
--------

- `node index.js balance --warn=2.5`
  This will query Aave for your balances and give you them in a nice table format, warning you via a message on screen and possibly IFTTT if the health factor is below 2.5
