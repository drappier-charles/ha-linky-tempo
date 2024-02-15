import dayjs, { Dayjs } from 'dayjs';
import fs from 'fs';
import { AveragePowerResponse, Session } from 'linky';
import { debug, info, warn } from './log.js';
import { TempoClient } from './tempo.js';
export type LinkyDataPoint = { date: string; value: number };
export type EnergyDataPoint = {
  start: string;
  state: number;
  state_blue_hc: number;
  state_blue_hp: number;
  state_white_hc: number;
  state_white_hp: number;
  state_red_hc: number;
  state_red_hp: number;
  sum: number;
  sum_blue_hc: number;
  sum_blue_hp: number;
  sum_white_hc: number;
  sum_white_hp: number;
  sum_red_hc: number;
  sum_red_hp: number;
};

export class LinkyClient {
  private session: Session;
  public prm: string;
  public isProduction: boolean;
  private tempoClient: TempoClient;
  constructor(token: string, prm: string, isProduction: boolean, clientId: string, clientSecret: string) {
    this.tempoClient = new TempoClient(clientId, clientSecret);
    this.prm = prm;
    this.isProduction = isProduction;
    this.session = new Session(token, prm);
    this.session.userAgent = 'ha-linky/1.2.0';
  }

  public async getLoadCurve(from, to) {
    const middle = dayjs(from).add(7, 'days').add(1, 'hour').format('YYYY-MM-DD');
    console.log('here', from, middle, to);
    const first = await this.session.getLoadCurve(from, middle);
    fs.writeFileSync('/data/first.json', JSON.stringify(first, null, 2), {
      encoding: 'utf-8',
    });
    console.log('here2');
    if (middle >= to) return first;
    const second = await this.session.getLoadCurve(middle, to);
    fs.writeFileSync('/data/second.json', JSON.stringify(second, null, 2), {
      encoding: 'utf-8',
    });
    first.interval_reading = first.interval_reading.concat(second.interval_reading);
    return first;
  }

  public async getEnergyData(firstDay: null | Dayjs): Promise<EnergyDataPoint[]> {
    const history: LinkyDataPoint[][] = [];
    let offset = 0;
    let limitReached = false;
    const keyword = this.isProduction ? 'production' : 'consumption';

    let interval = 14;
    let from = dayjs()
      .subtract(offset + interval, 'days')
      .format('YYYY-MM-DD');

    if (
      firstDay &&
      dayjs()
        .subtract(offset + interval, 'days')
        .isBefore(firstDay, 'day')
    ) {
      from = firstDay.format('YYYY-MM-DD');
      limitReached = true;
    }

    let to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

    try {
      const loadCurve = this.isProduction
        ? await this.session.getProductionLoadCurve(from, to)
        : await this.getLoadCurve(from, to);
      fs.writeFileSync('/data/loadCurve.json', JSON.stringify(loadCurve, null, 2), {
        encoding: 'utf-8',
      });
      history.unshift(LinkyClient.formatLoadCurve(loadCurve));
      debug(`Successfully retrieved ${keyword} load curve from ${from} to ${to}`);
      offset += interval;
    } catch (e) {
      debug(`Cannot fetch ${keyword} load curve from ${from} to ${to}, here is the error:`);
      warn(e);
    }

    for (let loop = 0; loop < 10; loop++) {
      if (limitReached) {
        break;
      }
      interval = 150;
      from = dayjs()
        .subtract(offset + interval, 'days')
        .format('YYYY-MM-DD');
      to = dayjs().subtract(offset, 'days').format('YYYY-MM-DD');

      if (
        firstDay &&
        dayjs()
          .subtract(offset + interval, 'days')
          .isBefore(firstDay, 'day')
      ) {
        from = firstDay.format('YYYY-MM-DD');
        limitReached = true;
      }
    }

    const dataPoints: LinkyDataPoint[] = history.flat();

    if (dataPoints.length === 0) {
      warn('Data import returned nothing !');
    } else {
      const intervalFrom = dayjs(dataPoints[0].date).format('DD/MM/YYYY');
      const intervalTo = dayjs(dataPoints[dataPoints.length - 1].date).format('DD/MM/YYYY');
      info(`Data import returned ${dataPoints.length} data points from ${intervalFrom} to ${intervalTo}`);
    }

    const result: EnergyDataPoint[] = [];
    for (let i = 0; i < dataPoints.length; i++) {
      result[i] = {
        start: dataPoints[i].date,
        state: dataPoints[i].value,
        sum: dataPoints[i].value + (i === 0 ? 0 : result[i - 1].sum),
        ...(await this.tempoClient.compute(dataPoints[i].date, dataPoints[i].value, i === 0 ? null : result[i - 1])),
      };
    }

    return result;
  }

  static formatLoadCurve(data: AveragePowerResponse): LinkyDataPoint[] {
    const formatted = data.interval_reading.map((r) => ({
      value: +r.value,
      date: dayjs(r.date)
        .subtract((r as any).interval_length.match(/\d+/)[0], 'minute')
        .startOf('hour')
        .format('YYYY-MM-DDTHH:mm:ssZ'),
    }));
    const grouped = formatted.reduce(
      (acc, cur) => {
        const date = cur.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(cur.value);
        return acc;
      },
      {} as { [date: string]: number[] },
    );
    return Object.entries(grouped).map(([date, values]) => ({
      date,
      value: values.reduce((acc, cur) => acc + cur, 0) / values.length,
    }));
  }
}
