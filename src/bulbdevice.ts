import TuyAPI = require('tuyapi');
import col = require('./color')
import logger = require('./log');
import { HSV, hsv_to_hex, interpolate_colors, timeoutPromise } from './core';
import EventEmitter = require('node:events');
import { LightDgramProperty } from './lightdgram';

const log = logger.log;

const timeoutMs = 500;

function formatDps(data) {
    if (data.dps === undefined)
        return data;

    if (data.dps.hasOwnProperty('20')) {
        data.dps.power = data.dps['20'];
        delete data.dps['20'];
    }

    if (data.dps.hasOwnProperty('24')) {
        data.dps.color = col.TuyaToHSV(data.dps['24']);
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
        data.dps.warmth = data.dps['23'];
        delete data.dps['23'];
    }

    if (data.hasOwnProperty('t'))
        delete data.t;

    return data;
}

interface SetOptions {
    shouldWaitForResponse?: boolean;
    dps?: number;
    set?: any;
    multiple?: boolean;
    data?: { [dps: string]: any }
}

interface BulbInfo {
    id: string,
    key: string,
    ip: string,
    name: string
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
    pow: any;
    col: HSV;
    mode: any;
    brightness: any;
    colortemp: any;
    status: any;
    initialLog: boolean = true;

    constructor({ id, key, ip, name = '' }: BulbInfo) {
        super({ id, key, ip, version: 3.3 });
        this.name = name;
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

    // 0004c02ba03e800000000
    // 000fc03e8032000000000
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
                    const color = decodeColor(d.value);
                    options.data[dps] = hsv_to_hex(color);
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

        function decodeColor(colorText: string): HSV {
            const matches = colorText.match(/h([0-9.]+)s([0-9.]+)v([0-9.]+)/);
            const h = parseFloat(matches[1]);
            const s = parseFloat(matches[2]);
            const v = parseFloat(matches[3]);
            return { h, s, v };
        }
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

    onData(data) {
        if (this.initialLog) {
            log(`${this.name} init-rcvd: ${JSON.stringify(data)}`, 3);
            this.initialLog = false;
        }
        else
            log(`${this.name} rcvd: ${JSON.stringify(data)}`, 1);

        if (data.dps !== undefined) {
            if (data.dps['20'] !== undefined) {
                this.pow = data.dps['20'];
                super.emit('propertychanged', LightDgramProperty.Power, this.pow);
            }
            if (data.dps['24'] !== undefined) {
                this.col = col.TuyaToHSV(data.dps['24']);
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

    set_status(status) {
        this.status = status;
        log(this.status, 2);
    }

    async get_power() {
        const power = await this.get({ dps: 20 });
        return { dps: { power } };
    }

    async set_power(power) {
        const data = await this.set({ dps: 20, set: power });
        return formatDps(data);
    }

    async get_color() {
        const color = await this.get({ dps: 24 });
        return { dps: { color: col.TuyaToHSV(color) } };
    }

    async set_color(color) {
        const h = color.h >= 0 ? color.h : this.col.h;
        const s = color.s >= 0 ? color.s : this.col.s;
        const v = color.v >= 0 ? color.v : this.col.v;
        const hex = hsv_to_hex({ h, s, v });

        const data = await this.set({ dps: 24, set: hex });
        return formatDps(data);
    }

    formatMode(data) {
        if (data === "colour")
            data = "color";
        return { dps: { mode: data } };
    }

    async get_mode() {
        const data = await this.get({ dps: 21 });
        return formatDps(data);
    }

    async set_mode(mode) {
        if (mode === 'color' || mode === 'colour')
            return formatDps(await this.set({ dps: 21, set: 'colour' }));
        else if (mode === 'white')
            return formatDps(await this.set({ dps: 21, set: 'white' }));
    }

    formatBrightness(data) {
        return { dps: { brightness: data } };
    }

    async get_brightness() {
        const data = await this.get({ dps: 22 });
        return formatDps(data);
    }

    async set_brightness(brightness: number) {
        const data = await this.set({ dps: 22, set: brightness });
        return formatDps(data);
    }

    formatWarmth(data) {
        return { dps: { warmth: data } };
    }

    async get_warmth() {
        const data = await this.get({ dps: 23 });
        return formatDps(data);
    }

    async set_warmth(warmth: number) {
        const data = await this.set({ dps: 23, set: warmth });
        return formatDps(data);
    }
}

export function TryGetBulb(info: BulbInfo): Promise<Bulb> {
    return new Promise((resolve, reject) => {
        const bulb = new Bulb(info);

        const timeout = setTimeout(() => { bulb.disconnect(); }, 3000)

        bulb.connect().then(() => {
            clearTimeout(timeout);
            resolve(bulb);
        }, (p) => reject(p))
    });
}