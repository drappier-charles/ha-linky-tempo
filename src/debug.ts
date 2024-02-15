import dayjs from 'dayjs';
import fs from 'fs';
import { getUserConfig } from './config.js';
import { HomeAssistantClient } from './ha.js';
import { debug, error } from './log.js';
async function main() {
  debug('HA Linky is starting');

  const haClient = new HomeAssistantClient();
  await haClient.connect();

  const userConfig = getUserConfig();
  const currentData = await haClient.getData(userConfig.consumption.prm);
  currentData.result;
  for (const key in currentData.result) {
    currentData.result[key].map((d) => {
      d.start = dayjs(d.start).format();
      d.end = dayjs(d.end).format();
      return d;
    });
  }
  fs.writeFileSync('/data/currentData.json', JSON.stringify(currentData.result, null, 2), 'utf-8');

  haClient.disconnect();
}

try {
  await main();
} catch (e) {
  error(e.toString());
  process.exit(1);
}
