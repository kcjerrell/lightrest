export interface HSV {
    h: number;
    s: number;
    v: number;
}

// https://stackoverflow.com/a/11410079/839853
export function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function rand(min: number, max: number): number {
    return (max - min) * Math.random() + min;
}

export function rand_gap(
    min: number,
    max: number,
    gapMin: number,
    gapMax: number
) {
    // gap_min = Math.max(min, gap_min);
    // gap_max = Math.min(max, gap_max);

    const range = max - min;
    let x = range * Math.random() + min;

    // x is in the gap
    if (x > gapMin && x < gapMax) {
        // x is closer to the max edge
        if (x > (gapMax - gapMin) / 2) {
            x = gapMax;
        }
        // x is closer to the min edge
        else {
            x = gapMin;
        }

        // make sure that didn't put us out of range
        if (x > max) x = gapMin;
        else if (x < min) x = gapMax;
    }

    return x;
}

export function interpolate_colors(colorA: HSV, colorB: HSV, prog: number) {
    const h = (colorB.h - colorA.h) * prog + colorA.h;
    const s = (colorB.s - colorA.s) * prog + colorA.s;
    const v = (colorB.v - colorA.v) * prog + colorA.v;

    return { h, s, v };
}

export function hsv_to_hex(h: number, s: number, v: number) {
    const hh = Math.round(h * 360);
    const hs = Math.round(s * 1000);
    const hv = Math.round(v * 1000);

    const hex =
        hh.toString(16).padStart(4, "0") +
        hs.toString(16).padStart(4, "0") +
        hv.toString(16).padStart(4, "0");
    return hex;
}

export interface BulbInfo {
    id?: string;
    key?: string;
    ip?: string;
    name?: string;
}

/* export function timeoutPromise(executor: Executor, toCallback: TimeoutCallback, durationMs: number) {
    const cancelToken = { cancelled: false, timedOut: false };

    setTimeout((tc: TimeoutCallback) => {
        cancelToken.timedOut = true;
        tc(durationMs);
    }, durationMs, toCallback);


}

type Executor = (resolve: (value: unknown) => void, reject: (reason: any) => void) => void;

type TimeoutCallback = (elapsedMs: number) => void; */
