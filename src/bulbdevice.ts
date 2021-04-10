import TuyAPI = require('tuyapi');
import col = require('./color')
import logger = require('./log');
import * as devProp from './deviceproperty';
import { HSV, hsv_to_hex, interpolate_colors } from './core';

const log = logger.log;

const timeoutMs = 1000;

function formatDps(data) {
    // log(data,3);

    if (data.dps == undefined)
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

interface setOptions {
    dps?: number;
    set?: any;
    multiple?: boolean;
    data?: object;
}

export class Bulb extends TuyAPI {
    name: string;
    pow: any;
    col: HSV;
    mode: any;
    brightness: any;
    colortemp: any;
    status: any;

    constructor({ id, key, ip, name = '' }) {
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

    // since I plan on (or want to be able to) make light color changes up to several times a second
    // and since occaisionally requests justs don't go through, hang, or fail
    // I need to fix that. Right now when a request doesn't work, the light gets 'stuck' until I
    // reconnect
    // but I don't think you can cancel a promise like you can cancel a Task in c#. At least not one
    // you didn't write.
    set(options: setOptions): Promise<object> {
        const promise = new Promise<object>((resolve, reject) => {
            // tslint:disable-next-line: no-trailing-whitespace

            const cancelToken = { cancelled: false };

            const to = setTimeout((elapsedMs) => {
                cancelToken.cancelled = true;
                reject({ error: "timedout", elapsedMs });
            }, timeoutMs, timeoutMs);

            super.set(options).then((value) => {
                if (!cancelToken.cancelled) {
                    clearTimeout(to);
                    resolve(value);
                }
            }, (reason) => {
                if (!cancelToken.cancelled) {
                    clearTimeout(to);
                    reject(reason);
                }
            });
        });
        return promise;
    }

    onData(data) {
        // log(`${this.name}: ${data}`, 0);

        if (data.dps != undefined) {
            if (data.dps['20'] != undefined)
                this.pow = data.dps['20'];
            if (data.dps['24'] != undefined)
                this.col = col.TuyaToHSV(data.dps['24']);
            if (data.dps['21'] != undefined)
                this.mode = data.dps['21'];
            if (data.dps['22'] != undefined)
                this.brightness = data.dps['22'];
            if (data.dps['23'] != undefined)
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

    get_power() {
        return this.get({ dps: 20 }).then(
            (power) => {
                return { dps: { power } };
            }
        );
    }

    set_power(power) {
        return this.set({ dps: 20, set: power }).then(formatDps);
    }

    get_color() {
        return this.get({ dps: 24 }).then(
            (color) => {
                return { dps: { color: col.TuyaToHSV(color) } };
            });
    }

    set_color(color) {
        const h = color.h >= 0 ? color.h : this.col.h;
        const s = color.s >= 0 ? color.s : this.col.s;
        const v = color.v >= 0 ? color.v : this.col.v;

        if (color.t > 0) {
            const start = Date.now();
            const colA = { h: this.col.h, s: this.col.s, v: this.col.v };
            const colB = { h, s, v };
            const duration = color.t;

            setTimeout(() => this.fade_color(colA, colB, start, duration), 10,);
            return Promise.resolve({ dps: {} });
        }

        const hex = hsv_to_hex(h, s, v);
        return this.set({ dps: 24, set: hex }).then(formatDps);
    }

    formatMode(data) {
        if (data == "colour")
            data = "color";
        return { dps: { mode: data } };
    }

    get_mode() {
        return this.get({ dps: 21 }).then(formatDps);
    }

    set_mode(mode) {
        if (mode == 'color' || mode == 'colour')
            return this.set({ dps: 21, set: 'colour' }).then(formatDps);
        else if (mode == 'white')
            return this.set({ dps: 21, set: 'white' }).then(formatDps);
    }

    formatBrightness(data) {
        return { dps: { brightness: data } };
    }

    get_brightness() {
        return this.get({ dps: 22 }).then(formatDps);
    }

    set_brightness(brightness: number) {
        return this.set({ dps: 22, set: brightness }).then(formatDps);
    }

    formatWarmth(data) {
        return { dps: { warmth: data } };
    }

    get_warmth() {
        return this.get({ dps: 23 }).then(formatDps);
    }

    set_warmth(warmth: number) {
        return this.set({ dps: 23, set: warmth }).then(formatDps);
    }

    fade_count: number = 0;
    fade_frames: number[] = []
    fade_color(colA: HSV, colB: HSV, start: number, duration: number, callback: Function = undefined) {
        const now = Date.now();
        const prog = (now - start) / duration;

        this.fade_frames.push(now - start)
        this.fade_count += 1;
        if (this.fade_count % 10 == 0)
            log(`${this.fade_count}`);

        if (prog >= 1) {
            this.fade_count = 0;
            // log(this.fade_frames);
            this.set_color(colB);
            if (callback != undefined)
                callback();
        }
        else {
            const col = interpolate_colors(colA, colB, prog);
            const hex = hsv_to_hex(col.h, col.s, col.v);
            this.set({ dps: 24, set: hex }).then(() => this.fade_color(colA, colB, start, duration));
        }
    }

    bubble_state: number = 0;
    bubble_a: HSV = { h: .5, s: .7, v: .9 }
    bubble_b: HSV = { h: .5, s: 1, v: .6 }
    bubble() {
        log("bub", 1);
        if (this.bubble_state % 2 == 0) {
            this.fade_color(this.bubble_a, this.bubble_b, Date.now(), 1500, () => this.bubble());
        }
        else {
            this.fade_color(this.bubble_b, this.bubble_a, Date.now(), 500, () => this.bubble());
        }
        this.bubble_state += 1;
    }

    async special() {
        const responses = [];

        await this.set({ dps: 20, set: true }).then(res => responses.push(res));
        await this.set({ dps: 21, set: "white" }).then(res => responses.push(res));
        await this.set({ dps: 22, set: 500 }).then(res => responses.push(res));
        await this.set({ dps: 23, set: 500 }).then(res => responses.push(res));
        await this.set({ dps: 24, set: hsv_to_hex(1, 1, 1) }).then(res => responses.push(res));

        log(responses);

        return (responses)
    }
}

export function TryGetBulb(info): Promise<Bulb> {
    return new Promise(function (resolve, reject) {
        const bulb = new Bulb(info);

        const timeout = setTimeout(() => { bulb.disconnect(); }, 3000)

        bulb.connect().then(() => {
            clearTimeout(timeout);
            resolve(bulb);
        }, (p) => reject(p))
    });
}