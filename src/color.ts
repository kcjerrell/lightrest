export class ColorFade {
    startColor: object;
    targetColor: object;
    duration: number;
    interval: number;
    data: string;
    startTime: number;
    timeout: NodeJS.Timeout;


    constructor(startColor, targetColor, duration, interval = 100) {
        this.startColor = startColor;
        this.targetColor = targetColor;
        this.duration = duration;
        this.interval = interval;
        this.data = '';
    }

    start(proc_callback, completed_callback) {
        this.startTime = Date.now()

        var timer_callback = function (fade) {
            var prog = (Date.now() - fade.startTime) / fade.duration;
            if (prog < 1) {
                var color = interpolate_colors(fade.startColor, fade.targetColor, prog);
                proc_callback(color);
                fade.data += `<p style="height: 25px; width: 25px; background-color: ${RGBtoHex(color.r, color.g, color.b)};"/>`
            }
            else {
                proc_callback(fade.targetColor);
                clearInterval(fade.timeout);
                completed_callback(fade.data);
            }
        }

        this.timeout = setInterval(timer_callback, this.interval, this);
    }
}

export function TuyaToHSV(hex) {
    var h = parseInt(hex.slice(1, 4), 16) / 360.0;
    var s = parseInt(hex.slice(4, 8), 16) / 1000.0;
    var v = parseInt(hex.slice(8, 12), 16) / 1000.0;

    //rgb = HSVtoRGB(h, s, v);

    return { h: h, s: s, v: v }; //r: rgb.r, g: rgb.g, b: rgb.b };
}

export function TuyaToRGBHSV(hex) {
    var h = parseInt(hex.slice(1, 4), 16) / 360.0;
    var s = parseInt(hex.slice(4, 8), 16) / 1000.0;
    var v = parseInt(hex.slice(8, 12), 16) / 1000.0;

    var rgb = HSVtoRGB(h, s, v);

    return { h: h, s: s, v: v, r: rgb.r, g: rgb.g, b: rgb.b };
}

export function HSVtoRGB(h, s, v) {
    //https://stackoverflow.com/a/17243070/839853

    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

export function RGBtoHSV(r, g, b) {
    //https://stackoverflow.com/a/17243070/839853

    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6 : 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return {
        h: h,
        s: s,
        v: v
    };
}

export function RGBtoHex(r, g, b) {
    //https://www.w3docs.com/snippets/javascript/how-to-convert-rgb-to-hex-and-vice-versa.html
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function interpolate_colors(colorA, colorB, prog) {
    var r = (colorB.r - colorA.r) * prog + colorA.r;
    var g = (colorB.g - colorA.g) * prog + colorA.g;
    var b = (colorB.b - colorA.b) * prog + colorA.b;

    return { r: r, g: g, b: b };
}