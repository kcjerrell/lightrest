import express = require("express");
import logger = require("./log");
import { clamp, sleep, timeoutPromise } from "./core";
import * as bulbDevice from "./bulbdevice";
import * as bulbInfoData from './deviceInfo.json';

const bulbInfo = bulbInfoData.bulbs;

const bulbs = loadBulbs(bulbInfo);

const log = logger.log;

// this is all very unsafe
function index_to_bulbs(index) {
    let bs = [];

    if (isNaN(index)) {
        if (index.includes(",") || index.includes("+")) {
            const split = index.replace(",", "+").split("+");
            for (let i = 0; i < split.length; i++) {
                bs = bs.concat(index_to_bulbs(split[i]));
            }
        } else if (index.includes("-")) {
            const split = index.split("-");

            for (let j = split[0]; j <= split[1]; j++) {
                bs = bs.concat(index_to_bulbs(j));
            }
        }
    } else if (index >= 0 && index < bulbs.length) bs.push(bulbs[index]);

    return bs;
}

const app = express();

app.set("json spaces", 4);

app.get("/bulbs", (req, res) => {
    const data = [];
    for (let i = 0; i < bulbs.length; i++) {
        data.push({
            index: i,
            name: bulbs[i].name,
            whatever: "hi",
            power: bulbs[i].pow,
            color: bulbs[i].col,
            mode: bulbs[i].mode,
            colortemp: bulbs[i].colortemp,
            brightness: bulbs[i].brightness,
        });
    }
    res.send({ bulbs: data });
});

let calls = 0;

app.get("/bulbs/:index/:prop", function (req, res) {
    calls += 1;
    if (calls % 10 === 0) console.log(calls);

    const index = req.params.index;
    const prop = req.params.prop;
    const q = req.query;

    const bs = index_to_bulbs(index);

    if (bs.length === 0) {
        res.end();
        return;
    }

    let mapFunc;

    switch (prop) {
        case "power":
            if (q.v !== undefined && q.v.toString().toLowerCase() == "true")
                mapFunc = (bulb) => bulb.set_power(true);
            else if (q.v !== undefined && q.v.toString().toLowerCase() == "false")
                mapFunc = (bulb) => bulb.set_power(false);
            else mapFunc = (bulb) => bulb.get_power();
            break;

        case "color":
            const qh = q.hasOwnProperty("h")
                ? clamp(parseFloat(q.h.toString()), 0, 1)
                : -1;
            const qs = q.hasOwnProperty("s")
                ? clamp(parseFloat(q.s.toString()), 0, 1)
                : -1;
            const qv = q.hasOwnProperty("v")
                ? clamp(parseFloat(q.v.toString()), 0, 1)
                : -1;
            const qt = q.hasOwnProperty("t") ? parseFloat(q.t.toString()) : 0;

            if (q.h != undefined || q.s != undefined || q.v != undefined)
                mapFunc = (bulb) => bulb.set_color({ h: qh, s: qs, v: qv, t: qt });
            else mapFunc = (bulb) => bulb.get_color();
            break;

        case "mode":
            if (
                q.v !== undefined &&
                (q.v.toString().toLowerCase() == "color" ||
                    q.v.toString().toLowerCase() == "colour" ||
                    q.v.toString().toLowerCase() == "white")
            )
                mapFunc = (bulb) => bulb.set_mode(q.v.toString().toLowerCase());
            else mapFunc = (bulb) => bulb.get_mode();
            break;

        case "brightness":
            if (q.v !== undefined)
                mapFunc = (bulb) => bulb.set_brightness(parseInt(q.v.toString()));
            else mapFunc = (bulb) => bulb.get_brightness();
            break;

        case "warmth":
            if (q.v !== undefined)
                mapFunc = (bulb) => bulb.set_warmth(parseInt(q.V.toString()));
            else mapFunc = (bulb) => bulb.get_warmth();
            break;

        case "schema":
            mapFunc = (bulb) => {
                return bulb.get({ schema: true });
            };
            break;

        case "status":
            mapFunc = (bulb) => {
                return `${bulb.name}: ${bulb.pow} - ${bulb.mode} - ${bulb.brightness} - ${bulb.colortemp} - ${bulb.col.h},${bulb.col.s},${bulb.col.v}`;
            };
            break;

        case "spec":
            mapFunc = (bulb) => bulb.special();
            break;
    }

    const promises = bs.map(mapFunc);
    Promise.all(promises).then(
        (response) => {
            res.send({ data: response });
        },
        (reason) => {
            console.log(reason);
            res.status(408).end();
        }
    );
});

function bulbFromName(name: string): bulbDevice.Bulb {
    for (let i = 0; i < bulbs.length; i++) {
        const bulb = bulbs[i];
        if (bulb.name == name) return bulb;
    }
    return undefined;
}

const server = app.listen(1337);

function loadBulbs(info: { id: string; key: string; ip: string; name: string; }[]) {
    const bs: bulbDevice.Bulb[] = [];

    for (const bi of info) {
        bulbDevice.TryGetBulb(bi).then((b) => bs.push(b));
    }

    return bs;
}

