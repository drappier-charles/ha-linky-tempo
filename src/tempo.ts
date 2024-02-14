import axios from 'axios';
import dayjs from 'dayjs';
export class TempoClient {
  private clientId;
  private clientSecret;
  private cache;
  private accessToken;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.cache = null;
    this.accessToken = null;
  }

  async login() {
    const options = {
      method: 'POST',
      url: 'https://digital.iservices.rte-france.com/token/oauth/',
      auth: {
        username: this.clientId,
        password: this.clientSecret,
      },
    };
    const { data } = await axios(options);
    this.accessToken = data.access_token;
  }

  async loadData() {
    if (this.cache) return;
    await this.login();
    const options = {
      method: 'GET',
      url: 'https://digital.iservices.rte-france.com/open_api/tempo_like_supply_contract/v1/tempo_like_calendars',
      params: {
        start_date: dayjs().subtract(1, 'month').format('YYYY-MM-DD') + 'T00:00:00+01:00',
        end_date: dayjs().add(2, 'day').format('YYYY-MM-DD') + 'T00:00:00+01:00',
        fallback_status: 'true',
      },
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };
    const { data } = await axios(options);
    this.cache = data.tempo_like_calendars.values;
  }

  async getDayColor(date: string) {
    await this.loadData();
    const hour = dayjs(date).hour();
    const day =
      hour >= 6
        ? dayjs(date).subtract(1, 'day').format('YYYY/MM/DD')
        : dayjs(date).subtract(2, 'day').format('YYYY/MM/DD');
    const dayData = this.cache.find((dayData) => {
      return dayjs(dayData.start_date).format('YYYY/MM/DD') === day;
    });
    return dayData.value;
  }

  async compute(
    date: string,
    value: number,
    prev: {
      sum_blue_hc: number;
      sum_blue_hp: number;
      sum_white_hc: number;
      sum_white_hp: number;
      sum_red_hc: number;
      sum_red_hp: number;
    },
  ) {
    // Need to compare date for HP/HC
    // Need to get info about date from tempo API
    const blue_hc: number = await this.computeValue(date, value, 'BLUE', 'hc');
    const blue_hp: number = await this.computeValue(date, value, 'BLUE', 'hp');
    const white_hc: number = await this.computeValue(date, value, 'WHITE', 'hc');
    const white_hp: number = await this.computeValue(date, value, 'WHITE', 'hp');
    const red_hc: number = await this.computeValue(date, value, 'RED', 'hc');
    const red_hp: number = await this.computeValue(date, value, 'RED', 'hp');

    return {
      state_blue_hc: blue_hc,
      state_blue_hp: blue_hp,
      state_white_hc: white_hc,
      state_white_hp: white_hp,
      state_red_hc: red_hc,
      state_red_hp: red_hp,
      sum_blue_hc: prev ? prev.sum_blue_hc + blue_hc : blue_hc,
      sum_blue_hp: prev ? prev.sum_blue_hp + blue_hp : blue_hp,
      sum_white_hc: prev ? prev.sum_white_hc + white_hc : white_hc,
      sum_white_hp: prev ? prev.sum_white_hp + white_hp : white_hp,
      sum_red_hc: prev ? prev.sum_red_hc + red_hc : red_hc,
      sum_red_hp: prev ? prev.sum_red_hp + red_hp : red_hp,
    };
  }

  async computeValue(date: string, value: number, color: string, type: string) {
    const isHc = dayjs(date).hour() < 6 || dayjs(date).hour() >= 22;
    const dayColor = await this.getDayColor(date);
    if (color === dayColor) {
      if (type === 'hp') return isHc ? 0 : value;
      if (type === 'hc') return isHc ? value : 0;
    }
    return 0;
  }
}
