import TuyAPI = require('tuyapi');
import logger = require('./log');
import { HSV, hsvToTuya, dgramToHsv, tuyaToHSV, BulbInfo } from './core';
import { LightDgramProperty } from './lightdgram';

const log = logger.log;

interface SetOptions {
    shouldWaitForResponse?: boolean;
    dps?: number;
    set?: any;
    multiple?: boolean;
    data?: { [dps: string]: any }
}

const dpsProps = {
    'power': '20',
    'mode': '21',
    'brightness': '22',
    'colortemp': '23',
    'color': '24',
    'music': '27',
    '20': 'power',
    '21': 'mode',
    '22': 'brightness',
    '23': 'colortemp',
    '24': 'color',
    '27': 'music'
};

export class Bulb extends TuyAPI {
    name: string;
    id: string;
    pow: any;
    col: HSV;
    mode: any;
    brightness: any;
    colortemp: any;
    status: any;

    constructor({ id, key, ip }: BulbInfo) {
        super({ id, ip, key, version: 3.3 });
        this.name = id.slice(-5);
        this.id = id;
        this.on('connected', this.onConnected);
        this.on('data', this.onData);
        this.on('disconnected', this.onDisconnected);
        this.on('error', this.onError);
    }

    onConnected() {
        log(`${this.name} connected`, 4);
        super.get({ schema: true });
    }

    set(options: SetOptions): Promise<object> {
        log(`setting property: ${JSON.stringify(options)}`, 2)
        return super.set(options);
    }

    qset(data: { property: string, value: string }[]) {
        const options: SetOptions = {
            shouldWaitForResponse: false,
            multiple: true,
            data: {}
        }

        data.forEach(d => {
            const dps = dpsProps[d.property];

            switch (d.property) {
                case 'power':
                    options.data[dps] = (/true/i).test(d.value);
                    break;

                case 'color':
                    const color = dgramToHsv(d.value);
                    options.data[dps] = hsvToTuya(color);
                    break;

                case 'mode':
                    options.data[dps] = Bulb.validateMode(d.value);
                    break;

                case 'brightness':
                    options.data[dps] = parseFloat(d.value);
                    break;

                case 'colortemp':
                    options.data[dps] = parseFloat(d.value);

                default:
                    break;
            }
        });

        this.set(options);
    }

    qdTap(color: HSV) {
        // the idea here is to see how the bulbs transition when receiving two calls within a short window
        // the desired color is within the fade limit
        // so request is made outside of that range, and then stop talking you get it

        const options: SetOptions = {
            shouldWaitForResponse: false,
            multiple: true,
            data: {}
        }

        const midColor = this.col;
        midColor.v = midColor.v + 0.2 > 1.0 ? midColor.v - 0.2 : midColor.v + 0.2;
        options.data['24'] = hsvToTuya(midColor);
        console.log(midColor);

        this.set(options).then(data => {
            options.data['24'] = hsvToTuya(color);
            this.set(options);
        })
    }

    onData(data) {
        log(`${this.name} rcvd: ${JSON.stringify(data)}`, 1);

        if (data.dps !== undefined) {
            if (data.dps['20'] !== undefined) {
                this.pow = data.dps['20'];
                super.emit('propertychanged', LightDgramProperty.Power, this.pow);
            }
            if (data.dps['24'] !== undefined) {
                this.col = tuyaToHSV(data.dps['24']);
                super.emit('propertychanged', LightDgramProperty.Color, this.col);
            }
            if (data.dps['21'] !== undefined) {
                this.mode = data.dps['21'];
                super.emit('propertychanged', LightDgramProperty.Mode, this.mode);
            }
            if (data.dps['22'] !== undefined) {
                this.brightness = data.dps['22'];
                super.emit('propertychanged', LightDgramProperty.Brightness, this.brightness);
            }
            if (data.dps['23'] !== undefined) {
                this.colortemp = data.dps['23'];
                super.emit('propertychanged', LightDgramProperty.ColorTemp, this.colortemp);
            }
        }
    }

    onDisconnected() {
        log(`${this.name} disconnected!`, 3);
    }

    onError(error) {
        log(`${this.name} error! ${error}`, 5);
    }

    async get_power() {
        const power = await this.get({ dps: 20 });
        return { dps: { power } };
    }

    async set_power(power) {
        const data = await this.set({ dps: 20, set: power });
        return Bulb.formatDps(data);
    }

    async get_color() {
        const color = await this.get({ dps: 24 });
        return { dps: { color: tuyaToHSV(color) } };
    }

    async set_color(color) {
        const h = color.h >= 0 ? color.h : this.col.h;
        const s = color.s >= 0 ? color.s : this.col.s;
        const v = color.v >= 0 ? color.v : this.col.v;
        const hex = hsvToTuya({ h, s, v });

        const data = await this.set({ dps: 24, set: hex });
        return Bulb.formatDps(data);
    }

    async get_mode() {
        const data = await this.get({ dps: 21 });
        return Bulb.formatDps(data);
    }

    async set_mode(mode) {
        const fmode = Bulb.validateMode(mode);
        if (mode != null)
            return Bulb.formatDps(await this.set({ dps: 21, set: fmode }));
    }

    static validateMode(mode: string) {
        const lmode = mode.toLowerCase();
        if (lmode === "color")
            return "colour";
        else if (lmode === "white" || lmode === "colour")
            return lmode;
        else
            return null;
    }

    async get_brightness() {
        const data = await this.get({ dps: 22 });
        return Bulb.formatDps(data);
    }

    async set_brightness(brightness: number) {
        const data = await this.set({ dps: 22, set: brightness });
        return Bulb.formatDps(data);
    }

    async get_colorTemp() {
        const data = await this.get({ dps: 23 });
        return Bulb.formatDps(data);
    }

    async set_colorTemp(colorTemp: number) {
        const data = await this.set({ dps: 23, set: colorTemp });
        return Bulb.formatDps(data);
    }

    static formatDps(data) {
        if (data.dps === undefined)
            return data;

        if (data.dps.hasOwnProperty('20')) {
            data.dps.power = data.dps['20'];
            delete data.dps['20'];
        }

        if (data.dps.hasOwnProperty('24')) {
            data.dps.color = tuyaToHSV(data.dps['24']);
            delete data.dps['24'];
        }

        if (data.dps.hasOwnProperty('21')) {
            data.dps.mode = data.dps['21'];
            delete data.dps['21'];
        }

        if (data.dps.hasOwnProperty('22')) {
            data.dps.brightness = data.dps['22'];
            delete data.dps['22'];
        }

        if (data.dps.hasOwnProperty('23')) {
            data.dps.colorTemp = data.dps['23'];
            delete data.dps['23'];
        }

        if (data.hasOwnProperty('t'))
            delete data.t;

        return data;
    }
}

export function TryGetBulb(info: BulbInfo): Promise<Bulb> {
    return new Promise((resolve, reject) => {
        log(`bulb requested ${info.id}`, 5);
        const bulb = new Bulb(info);

        const timeout = setTimeout(() => { bulb.disconnect(); }, 3000)

        bulb.connect().then(() => {
            clearTimeout(timeout);
            resolve(bulb);
        }, (p) => reject(p))
    });
}