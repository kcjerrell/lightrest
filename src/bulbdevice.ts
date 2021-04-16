import TuyAPI = require('tuyapi');
import col = require('./color')
import logger = require('./log');
import * as devProp from './deviceproperty';
import { HSV, hsv_to_hex, interpolate_colors, timeoutPromise } from './core';

const log = logger.log;

const timeoutMs = 500;

function formatDps(data) {
    // log(data,3);

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
    dps?: number;
    set?: any;
    multiple?: boolean;
    data?: object;
}

interface BulbInfo {
    id: string,
    key: string,
    ip: string,
    name: string
}

export class Bulb extends TuyAPI {
    name: string;
    pow: any;
    col: HSV;
    mode: any;
    brightness: any;
    colortemp: any;
    status: any;

    constructor({ id, key, ip, name = '' }: BulbInfo) {
        super({ id, key, ip, version: 3.3 });
        this.name = name;
        this.on('connected', this.onConnected);
        this.on('data', this.onData);
        this.on('disconnected', this.onDisconnected);
        this.on('error', this.onError);
    }

    onConnected() {
        log(`${this.name} connected`, 2);
    }

    set(options: SetOptions): Promise<object> {
        const promise = new Promise<object>((resolve, reject) => {
            const cancelToken = { cancelled: false };

            const to = setTimeout((elapsedMs) => {
                cancelToken.cancelled = true;
                resolve({ error: "timedout", elapsedMs });
            }, timeoutMs, timeoutMs);

            super.set(options).then((value) => {
                if (!cancelToken.cancelled) {
                    clearTimeout(to);
                    resolve(value);
                }
            }, (reason) => {
                if (!cancelToken.cancelled) {
                    clearTimeout(to);
                    resolve({ error: reason });
                }
            });
        });
        return promise;
    }

    onData(data) {
        // log(`${this.name}: ${data}`, 0);

        if (data.dps !== undefined) {
            if (data.dps['20'] !== undefined)
                this.pow = data.dps['20'];
            if (data.dps['24'] !== undefined)
                this.col = col.TuyaToHSV(data.dps['24']);
            if (data.dps['21'] !== undefined)
                this.mode = data.dps['21'];
            if (data.dps['22'] !== undefined)
                this.brightness = data.dps['22'];
            if (data.dps['23'] !== undefined)
                this.colortemp = data.dps['23'];
        }
    }

    onDisconnected() {
        log(`${this.name} disconnected!`, 2);
    }

    onError(error) {
        log(`${this.name} error! ${error}`, 0);
    }

    set_status(status) {
        this.status = status;
        // console.log(this.status);
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
        const hex = hsv_to_hex(h, s, v);

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