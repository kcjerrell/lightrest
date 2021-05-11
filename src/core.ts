export interface HSV {
    h: number;
    s: number;
    v: number;
}

// https://stackoverflow.com/a/11410079/839853
export function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}

export function interpolate_colors(colorA: HSV, colorB: HSV, prog: number) {
    const h = (colorB.h - colorA.h) * prog + colorA.h;
    const s = (colorB.s - colorA.s) * prog + colorA.s;
    const v = (colorB.v - colorA.v) * prog + colorA.v;

    return { h, s, v };
}

export function hsvToTuya({ h, s, v }) {
    const hh = Math.round(h * 360);
    const hs = Math.round(s * 1000);
    const hv = Math.round(v * 1000);

    const hex =
        hh.toString(16).padStart(4, "0") +
        hs.toString(16).padStart(4, "0") +
        hv.toString(16).padStart(4, "0");
    return hex;
}

export function dgramToHsv(colorText: string): HSV {
    const matches = colorText.match(/h([0-9.]+)s([0-9.]+)v([0-9.]+)/);
    const h = parseFloat(matches[1]);
    const s = parseFloat(matches[2]);
    const v = parseFloat(matches[3]);
    return { h, s, v };
}

export function tuyaToHSV(hex) {
    const h = parseInt(hex.slice(1, 4), 16) / 360.0;
    const s = parseInt(hex.slice(4, 8), 16) / 1000.0;
    const v = parseInt(hex.slice(8, 12), 16) / 1000.0;

    return { h, s, v };
}

export interface BulbInfo {
    id?: string;
    key?: string;
    ip?: string;
    name?: string;
}
