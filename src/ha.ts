import dayjs from 'dayjs';
import fs from 'fs';
import { MSG_TYPE_AUTH_INVALID, MSG_TYPE_AUTH_OK, MSG_TYPE_AUTH_REQUIRED } from 'home-assistant-js-websocket';
import { auth } from 'home-assistant-js-websocket/dist/messages.js';
import ws, { Message } from 'websocket';
import { debug, warn } from './log.js';

const WS_URL = process.env.WS_URL || 'ws://supervisor/core/websocket';
const TOKEN = process.env.SUPERVISOR_TOKEN;

export type SuccessMessage = {
  id: string;
  type: string;
  success: true;
  result: any;
};

export type ErrorMessage = {
  id: string;
  type: string;
  success: false;
  error: any;
};

export type ResultMessage = SuccessMessage | ErrorMessage;

function getStatisticId(prm: string, type) {
  return `linky_${type}:${prm}`;
}

export class HomeAssistantClient {
  private messageId = Number(Date.now().toString().slice(9));
  private connection: ws.connection;

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client: ws.client = new ws.client();

      client.addListener('connectFailed', function (error) {
        reject('Connection with Home Assistant failed : ' + error.toString());
      });
      client.addListener('connect', (connection: ws.connection) => {
        connection.on('error', (error) => {
          reject('Connection with Home Assistant returned an error : ' + error.toString());
        });

        connection.on('close', () => {
          debug('Connection with Home Assistant closed');
        });

        connection.once('message', (message: Message) => {
          if (message.type === 'utf8' && JSON.parse(message.utf8Data).type === MSG_TYPE_AUTH_REQUIRED) {
            connection.once('message', (message) => {
              if (message.type === 'utf8') {
                const parsed: { type: string } = JSON.parse(message.utf8Data);
                if (parsed.type === MSG_TYPE_AUTH_INVALID) {
                  reject('Cannot authenticate with Home Assistant');
                }
                if (parsed.type === MSG_TYPE_AUTH_OK) {
                  debug('Connection with Home Assistant established');
                  this.connection = connection;
                  resolve();
                }
              }
            });

            connection.sendUTF(JSON.stringify(auth(TOKEN)));
          }
        });
      });
      client.connect(WS_URL);
    });
  }

  public disconnect() {
    this.connection.close();
  }

  private sendMessage(message: { [key: string]: any }): Promise<SuccessMessage> {
    message.id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.connection.once('message', (message: Message) => {
        if (message.type === 'utf8') {
          const response: ResultMessage = JSON.parse(message.utf8Data);
          if (response.success) {
            resolve(response);
          } else {
            reject('Home Assistant returned an error : ' + message.utf8Data);
          }
        }
      });
      this.connection.sendUTF(JSON.stringify(message));
    });
  }

  public async getData(prm) {
    const statisticId = getStatisticId(prm, 'standard');
    const statisticIdFixed = getStatisticId(prm, 'fixed');
    const statisticIdFixedPrice = getStatisticId(prm, 'fixed_price');
    const statisticIdBlueHc = getStatisticId(prm, 'blue_hc');
    const statisticIdBlueHp = getStatisticId(prm, 'blue_hp');
    const statisticIdWhiteHc = getStatisticId(prm, 'white_hc');
    const statisticIdWhiteHp = getStatisticId(prm, 'white_hp');
    const statisticIdRedHc = getStatisticId(prm, 'red_hc');
    const statisticIdRedHp = getStatisticId(prm, 'red_hp');

    const options = {
      type: 'recorder/statistics_during_period',
      start_time: dayjs().subtract(10, 'days').format('YYYY-MM-DDT00:00:00.00Z'),
      end_time: dayjs().format('YYYY-MM-DDT00:00:00.00Z'),
      statistic_ids: [
        statisticId,
        statisticIdFixed,
        statisticIdFixedPrice,
        statisticIdBlueHc,
        statisticIdBlueHp,
        statisticIdWhiteHc,
        statisticIdWhiteHp,
        statisticIdRedHc,
        statisticIdRedHp,
      ],
      period: 'hour',
    };
    const data = await this.sendMessage(options);
    return data;
  }

  public async saveStatistics(
    prm: string,
    name: string,
    stats: {
      start: string;
      state: number;
      state_blue_hc: number;
      state_blue_hp: number;
      state_white_hc: number;
      state_white_hp: number;
      state_red_hc: number;
      state_red_hp: number;
      state_fixed_price: number;
      sum: number;
      sum_blue_hc: number;
      sum_blue_hp: number;
      sum_white_hc: number;
      sum_white_hp: number;
      sum_red_hc: number;
      sum_red_hp: number;
      sum_fixed_price: number;
    }[],
  ) {
    stats = stats.map((s) => {
      s.start = dayjs(s.start).subtract(1, 'hour').format('YYYY-MM-DDTHH:mm:ssZ');
      return s;
    });

    fs.writeFileSync('/data/data.json', JSON.stringify(stats, null, 2), {
      encoding: 'utf-8',
    });
    await this.sendMessageColor(prm, stats, 'standard', 'Consomation Totale');
    await this.sendMessageColor(prm, stats, 'blue_hc', 'Bleu - Heure Creuse');
    await this.sendMessageColor(prm, stats, 'blue_hp', 'Bleu - Heure Pleine');
    await this.sendMessageColor(prm, stats, 'white_hc', 'Blanche - Heure Creuse');
    await this.sendMessageColor(prm, stats, 'white_hp', 'Blanche - Heure Pleine');
    await this.sendMessageColor(prm, stats, 'red_hc', 'Rouge - Heure Creuse');
    await this.sendMessageColor(prm, stats, 'red_hp', 'Rouge - Heure Pleine');
    await this.sendMessageStaticPrice(prm, stats, 'Abonnement');
  }

  public convertToPrice(color: string, value) {
    const prices = {
      blue_hc: 0.1296,
      blue_hp: 0.1609,
      white_hc: 0.1486,
      white_hp: 0.1894,
      red_hc: 0.1568,
      red_hp: 0.7562,
    };
    return (value * prices[color] || 0) / 1000;
  }
  public async sendMessageStaticPrice(prm, stats, name) {
    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name: name + ' - Prix',
        source: getStatisticId(prm, 'fixed_price').split(':')[0],
        statistic_id: getStatisticId(prm, 'fixed_price'),
        unit_of_measurement: 'Eur',
      },
      stats: stats.map((s) => {
        return {
          start: s.start,
          state: s.state_fixed_price,
          sum: s.sum_fixed_price,
        };
      }),
    });
    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name,
        source: getStatisticId(prm, 'fixed').split(':')[0],
        statistic_id: getStatisticId(prm, 'fixed'),
        unit_of_measurement: 'Wh',
      },
      stats: stats.map((s) => {
        return {
          start: s.start,
          state: 0,
          sum: 0,
        };
      }),
    });
  }

  public async sendMessageColor(
    prm: string,
    stats: {
      start: string;
      state: number;
      state_blue_hc: number;
      state_blue_hp: number;
      state_white_hc: number;
      state_white_hp: number;
      state_red_hc: number;
      state_red_hp: number;
      state_fixed_price: number;
      sum: number;
      sum_blue_hc: number;
      sum_blue_hp: number;
      sum_white_hc: number;
      sum_white_hp: number;
      sum_red_hc: number;
      sum_red_hp: number;
      sum_fixed_price: number;
    }[],
    color: string,
    name: string,
  ) {
    await this.sendMessage({
      type: 'recorder/import_statistics',
      metadata: {
        has_mean: false,
        has_sum: true,
        name: name,
        source: getStatisticId(prm, color).split(':')[0],
        statistic_id: getStatisticId(prm, color),
        unit_of_measurement: 'Wh',
      },
      stats: stats.map((s) => {
        return {
          start: s.start,
          state: color === 'standard' ? s.sum : s['state_' + color],
          sum: color === 'standard' ? s.sum : s['sum_' + color],
        };
      }),
    });
    if (color !== 'standard') {
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: name + ' - Prix',
          source: getStatisticId(prm, color + '_price').split(':')[0],
          statistic_id: getStatisticId(prm, color + '_price'),
          unit_of_measurement: 'Eur',
        },
        stats: stats.map((s) => {
          return {
            start: s.start,
            state: this.convertToPrice(color, s['state_' + color]),
            sum: this.convertToPrice(color, s['sum_' + color]),
          };
        }),
      });
    } else {
      await this.sendMessage({
        type: 'recorder/import_statistics',
        metadata: {
          has_mean: false,
          has_sum: true,
          name: name + ' - Prix',
          source: getStatisticId(prm, color + '_price').split(':')[0],
          statistic_id: getStatisticId(prm, color + '_price'),
          unit_of_measurement: 'Eur',
        },
        stats: stats.map((s) => {
          return {
            start: s.start,
            state:
              this.convertToPrice('blue_hc', s['state_blue_hc']) +
              this.convertToPrice('blue_hp', s['state_blue_hp']) +
              this.convertToPrice('white_hc', s['state_white_hc']) +
              this.convertToPrice('white_hp', s['state_white_hp']) +
              this.convertToPrice('red_hc', s['state_red_hc']) +
              this.convertToPrice('red_hp', s['state_red_hp']),
            sum:
              this.convertToPrice('blue_hc', s['sum_blue_hc']) +
              this.convertToPrice('blue_hp', s['sum_blue_hp']) +
              this.convertToPrice('white_hc', s['sum_white_hc']) +
              this.convertToPrice('white_hp', s['sum_white_hp']) +
              this.convertToPrice('red_hc', s['sum_red_hc']) +
              this.convertToPrice('red_hp', s['sum_red_hp']),
          };
        }),
      });
    }
  }

  public async isNewPRM(prm: string) {
    const statisticId = getStatisticId(prm, 'standard');
    const ids = await this.sendMessage({
      type: 'recorder/list_statistic_ids',
      statistic_type: 'sum',
    });
    return !ids.result.find((statistic: any) => statistic.statistic_id === statisticId);
  }

  public async findLastStatistic(prm: string): Promise<null | {
    start: number;
    end: number;
    standard: {
      state: number;
      sum: number;
      change: number;
    };
    fixed_price: {
      state: number;
      sum: number;
      change: number;
    };
    blue_hc: {
      state: number;
      sum: number;
      change: number;
    };
    blue_hp: {
      state: number;
      sum: number;
      change: number;
    };
    white_hc: {
      state: number;
      sum: number;
      change: number;
    };
    white_hp: {
      state: number;
      sum: number;
      change: number;
    };
    red_hc: {
      state: number;
      sum: number;
      change: number;
    };
    red_hp: {
      state: number;
      sum: number;
      change: number;
    };
  }> {
    const isNew = await this.isNewPRM(prm);
    if (isNew) {
      warn(`PRM ${prm} not found in Home Assistant statistics`);
      return null;
    }

    const statisticId = getStatisticId(prm, 'standard');
    const statisticIdFixedPrice = getStatisticId(prm, 'fixed_price');
    const statisticIdBlueHc = getStatisticId(prm, 'blue_hc');
    const statisticIdBlueHp = getStatisticId(prm, 'blue_hp');
    const statisticIdWhiteHc = getStatisticId(prm, 'white_hc');
    const statisticIdWhiteHp = getStatisticId(prm, 'white_hp');
    const statisticIdRedHc = getStatisticId(prm, 'red_hc');
    const statisticIdRedHp = getStatisticId(prm, 'red_hp');

    let res = null;
    // Loop over the last 52 weeks
    for (let i = 0; i < 52; i++) {
      const data = await this.sendMessage({
        type: 'recorder/statistics_during_period',
        start_time: dayjs()
          .subtract((i + 1) * 7, 'days')
          .format('YYYY-MM-DDT00:00:00.00Z'),
        end_time: dayjs()
          .subtract(i * 7, 'days')
          .format('YYYY-MM-DDT00:00:00.00Z'),
        statistic_ids: [
          statisticId,
          statisticIdBlueHc,
          statisticIdBlueHp,
          statisticIdWhiteHc,
          statisticIdWhiteHp,
          statisticIdRedHc,
          statisticIdRedHp,
          statisticIdFixedPrice,
        ],
        period: 'hour',
      });
      res = this.populateRes(res, data.result[statisticId], 'standard');
      res = this.populateRes(res, data.result[statisticIdFixedPrice], 'fixed_price');
      res = this.populateRes(res, data.result[statisticIdBlueHc], 'blue_hc');
      res = this.populateRes(res, data.result[statisticIdBlueHp], 'blue_hp');
      res = this.populateRes(res, data.result[statisticIdWhiteHc], 'white_hc');
      res = this.populateRes(res, data.result[statisticIdWhiteHp], 'white_hp');
      res = this.populateRes(res, data.result[statisticIdRedHc], 'red_hc');
      res = this.populateRes(res, data.result[statisticIdRedHp], 'red_hp');
      if (res) return res;
    }

    debug(`No statistics found for PRM ${prm} in Home Assistant`);
    return res;
  }

  public populateRes(res, points, color) {
    if (points && points.length > 0) {
      const lastDay = dayjs(points[points.length - 1].start).format('DD/MM/YYYY');
      debug('Last saved statistic date is ' + lastDay);
      res = res || {
        start: points[points.length - 1].start,
        end: points[points.length - 1].end,
      };
      res[color] = points[points.length - 1];
      return res;
    }
    return null;
  }

  public async purge(prm: string) {
    warn(`Removing all statistics for PRM ${prm}`);
    await this.sendMessage({
      type: 'recorder/clear_statistics',
      statistic_ids: [
        getStatisticId(prm, 'standard'),
        getStatisticId(prm, 'fixed'),
        getStatisticId(prm, 'fixed_price'),
        getStatisticId(prm, 'blue_hc'),
        getStatisticId(prm, 'blue_hp'),
        getStatisticId(prm, 'white_hc'),
        getStatisticId(prm, 'white_hp'),
        getStatisticId(prm, 'red_hc'),
        getStatisticId(prm, 'red_hp'),
        getStatisticId(prm, 'standard_price'),
        getStatisticId(prm, 'blue_hc_price'),
        getStatisticId(prm, 'blue_hp_price'),
        getStatisticId(prm, 'white_hc_price'),
        getStatisticId(prm, 'white_hp_price'),
        getStatisticId(prm, 'red_hc_price'),
        getStatisticId(prm, 'red_hp_price'),
      ],
    });
  }
}
