Inspired by https://github.com/bokub/ha-linky
But I'm a JS dev

Goal is to be able to completly integrate with EDF Tempo options, with complete pricing computing, and split between each color and hp/hc

You should find anything you need in the package.json if you are a JS dev

## How to launch it locally
```sh
LINKY_PRM=xxx \
LINKY_TOKEN="xxx" \
TEMPO_CLIENT_ID="xxx" \
TEMPO_CLIENT_SECRET="xxx" \
SUPERVISOR_TOKEN="xxx" \
WS_URL="xxx" \
PURGE='true' \ # Purge HA each time you push
CACHE='true' \ # Allow you to keep a cache locally to avoid reach the limit of API why developing
DRY_RUN='false' \ # Allow you to not push to HA (to do test)
MAX_DATE='2024-02-10' \ # Set a max date to test things
yarn start
```