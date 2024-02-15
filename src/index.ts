import dayjs from 'dayjs';
import fs from 'fs';
import cron from 'node-cron';
import { getUserConfig, MeterConfig, UserConfig } from './config.js';
import { HomeAssistantClient } from './ha.js';
import { LinkyClient } from './linky.js';
import { debug, error, info, warn } from './log.js';

async function main() {
  debug('HA Linky is starting');

  const userConfig = getUserConfig();

  // Stop if configuration is empty
  if (!userConfig.consumption && !userConfig.production) {
    warn('Add-on is not configured properly');
    debug('HA Linky stopped');
    return;
  }

  const haClient = new HomeAssistantClient();
  await haClient.connect();

  // Reset statistics if needed
  if (userConfig.consumption?.action === 'reset') {
    await haClient.purge(userConfig.consumption.prm, false);
    info('Consumption statistics removed successfully!');
  }
  if (userConfig.production?.action === 'reset') {
    await haClient.purge(userConfig.production.prm, true);
    info('Production statistics removed successfully!');
  }

  // Stop if nothing else to do
  if (userConfig.consumption?.action !== 'sync' && userConfig.production?.action !== 'sync') {
    haClient.disconnect();
    info('Nothing to sync');
    debug('HA Linky stopped');
    return;
  }

  async function init(config: MeterConfig, global: UserConfig) {
    info(
      `[${dayjs().format('DD/MM HH:mm')}] New PRM detected, importing as much historical ${
        config.isProduction ? 'production' : 'consumption'
      } data as possible`,
    );

    const client = new LinkyClient(config.token, config.prm, config.isProduction, global.clientId, global.clientSecret);
    const energyData = await client.getEnergyData(null);
    await haClient.saveStatistics(config.prm, config.name, config.isProduction, energyData);
  }

  async function sync(config: MeterConfig, global: UserConfig) {
    info(
      `[${dayjs().format('DD/MM HH:mm')}] Synchronization started for ${
        config.isProduction ? 'production' : 'consumption'
      } data`,
    );

    const lastStatistic = await haClient.findLastStatistic(config.prm, config.isProduction);
    if (!lastStatistic) {
      warn(`Data synchronization failed, no previous statistic found in Home Assistant`);
      return;
    }
    fs.writeFileSync('/data/lastStatistic.json', JSON.stringify(lastStatistic, null, 2), 'utf-8');

    const isSyncingNeeded = dayjs(lastStatistic.start).isBefore(dayjs().subtract(2, 'days')) && dayjs().hour() >= 6;
    if (!isSyncingNeeded) {
      debug('Everything is up to date, nothing to synchronize');
      return;
    }
    const client = new LinkyClient(config.token, config.prm, config.isProduction, global.clientId, global.clientSecret);
    const firstDay = dayjs(lastStatistic.start).add(1, 'day');
    const energyData = await client.getEnergyData(firstDay);
    fs.writeFileSync('/data/energyData.json', JSON.stringify(energyData, null, 2), 'utf-8');

    incrementSums(energyData, lastStatistic);
    fs.writeFileSync('/data/energyData2.json', JSON.stringify(energyData, null, 2), 'utf-8');
    await haClient.saveStatistics(config.prm, config.name, config.isProduction, energyData);
  }

  // Initialize or sync data
  for (const dataType in userConfig) {
    const config = userConfig[dataType];

    if (config?.action === 'sync') {
      info(`PRM ${config.prm} found in configuration for ${dataType}`);

      const isNew = await haClient.isNewPRM(config.prm, config.isProduction);
      if (isNew) {
        await init(config, userConfig);
      } else {
        await sync(config, userConfig);
      }
    }
  }

  haClient.disconnect();

  // Setup cron job
  const randomMinute = Math.floor(Math.random() * 59);
  const randomSecond = Math.floor(Math.random() * 59);

  info(
    `Data synchronization planned every day at ` +
      `06:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')} and ` +
      `09:${randomMinute.toString().padStart(2, '0')}:${randomSecond.toString().padStart(2, '0')}`,
  );

  cron.schedule(`${randomSecond} ${randomMinute} 6,9 * * *`, async () => {
    await haClient.connect();
    for (const dataType in userConfig) {
      if (userConfig[dataType]?.action === 'sync') {
        await sync(userConfig[dataType], userConfig);
      }
    }

    haClient.disconnect();
  });
}

function incrementSums(
  data: {
    sum: number;
    sum_blue_hc: number;
    sum_blue_hp: number;
    sum_white_hc: number;
    sum_white_hp: number;
    sum_red_hc: number;
    sum_red_hp: number;
  }[],
  stats: {
    standard: {
      sum: number;
    };
    blue_hc: {
      sum: number;
    };
    blue_hp: {
      sum: number;
    };
    white_hc: {
      sum: number;
    };
    white_hp: {
      sum: number;
    };
    red_hc: {
      sum: number;
    };
    red_hp: {
      sum: number;
    };
  },
) {
  return data.map((item) => {
    item.sum += stats.standard?.sum || 0;
    item.sum_blue_hc += stats.blue_hc?.sum || 0;
    item.sum_blue_hp += stats.blue_hp?.sum || 0;
    item.sum_white_hc += stats.white_hc?.sum || 0;
    item.sum_white_hp += stats.white_hp?.sum || 0;
    item.sum_red_hc += stats.red_hc?.sum || 0;
    item.sum_red_hp += stats.red_hp?.sum || 0;
    return item;
  });
}

try {
  await main();
} catch (e) {
  error(e.toString());
  process.exit(1);
}
