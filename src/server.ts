import express = require("express");
import * as bulbDevice from "./bulbdevice";
import { DeviceProperty } from "./deviceproperty";
import logger = require("./log");
import { LightCycle } from "./lightcycle";
import { clamp, sleep } from "./core";
import { trimod } from "./trimod";
import e = require("express");

const log = logger.log;

const bulbInfo = [
    {
        id: "eba040c47ea782ca16eiad",
        key: "e5cbe0a10dad9c93",
        ip: "192.168.0.21",
        name: "Face",
    },
    {
        id: "eb2773e38adbb12683puvk",
        key: "aa736ffedbe56ec8",
        ip: "192.168.0.23",
        name: "UpRight",
    },
    {
        id: "ebf1e92bd63d8c059dbcvn",
        key: "1022bf390de07246",
        ip: "192.168.0.18",
        name: "DownRight",
    },
    {
        id: "eb32d7cd40417c0f6addl9",
        key: "4b29203ead0de281",
        ip: "192.168.0.22",
        name: "DownLeft",
    },
    {
        id: "ebf8d36fec611039bbggej",
        key: "50dad0673f4febbc",
        ip: "192.168.0.17",
        name: "UpLeft",
    },
    {
        id: "ebfc8703b8fcfab217ot0v",
        key: "1a13a246e713fe58",
        ip: "192.168.0.24",
        name: "Up",
    },
];

const bulbs: bulbDevice.Bulb[] = [];

for (let i = 0; i < bulbInfo.length; i++) {
    bulbDevice.TryGetBulb(bulbInfo[i]).then(
        (bulb) => bulbs.push(bulb),
        (e) => console.log(e)
    );
}

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

("use strict");

const app = express();

app.set("json spaces", 4);

app.get("/bulbs", function (req, res) {
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
    if (calls % 10 == 0) console.log(calls);

    const index = req.params.index;
    const prop = req.params.prop;
    const q = req.query;

    const bs = index_to_bulbs(index);

    if (bs.length == 0) {
        res.end();
        return;
    }

    let mapFunc;

    switch (prop) {
        case "power":
            if (q.v != undefined && q.v.toString().toLowerCase() == "true")
                mapFunc = (bulb) => bulb.set_power(true);
            else if (q.v != undefined && q.v.toString().toLowerCase() == "false")
                mapFunc = (bulb) => bulb.set_power(false);
            else mapFunc = (bulb) => bulb.get_power();
            break;

        case "color":
            let qh = q.hasOwnProperty("h")
                ? clamp(parseFloat(q.h.toString()), 0, 1)
                : -1;
            let qs = q.hasOwnProperty("s")
                ? clamp(parseFloat(q.s.toString()), 0, 1)
                : -1;
            let qv = q.hasOwnProperty("v")
                ? clamp(parseFloat(q.v.toString()), 0, 1)
                : -1;
            let qt = q.hasOwnProperty("t") ? parseFloat(q.t.toString()) : 0;

            if (q.h != undefined || q.s != undefined || q.v != undefined)
                mapFunc = (bulb) => bulb.set_color({ h: qh, s: qs, v: qv, t: qt });
            else mapFunc = (bulb) => bulb.get_color();
            break;

        case "mode":
            if (
                q.v != undefined &&
                (q.v.toString().toLowerCase() == "color" ||
                    q.v.toString().toLowerCase() == "colour" ||
                    q.v.toString().toLowerCase() == "white")
            )
                mapFunc = (bulb) => bulb.set_mode(q.v.toString().toLowerCase());
            else mapFunc = (bulb) => bulb.get_mode();
            break;

        case "brightness":
            if (q.v != undefined)
                mapFunc = (bulb) => bulb.set_brightness(parseInt(q.v.toString()));
            else mapFunc = (bulb) => bulb.get_brightness();
            break;

        case "warmth":
            if (q.v != undefined)
                mapFunc = (bulb) => bulb.set_warmth(parseInt(q.V.toString()));
            else mapFunc = (bulb) => bulb.get_warmth();
            break;

        case "schema":
            mapFunc = function (bulb) {
                return bulb.get({ schema: true });
            };
            break;

        case "status":
            mapFunc = function (bulb) {
                return `${bulb.name}: ${bulb.pow} - ${bulb.mode} - ${bulb.brightness} - ${bulb.colortemp} - ${bulb.col.h},${bulb.col.s},${bulb.col.v}`;
            };
            break;

        case "spec":
            mapFunc = (bulb) => bulb.special();
            break;
    }

    let promises = bs.map(mapFunc);
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

app.get("/fun1", (req, res) => {
    setTimeout(() => fun(1), 500);
    return "Fun!";
});

app.get("/fun2", (req, res) => {
    if (lcs == undefined) {
        fun(2);
        res.send("Fun2!");
    } else {
        lcs.forEach((lc) => {
            lc.stop();
        });
        lcs = undefined;
        res.send("No fun2!");
    }
});
let lcs: LightCycle[];

let tms: trimod[];
app.get("/fun3", (req, res) => {
    if (tms != undefined) {
        for (let i = 0; i < tms.length; i++) {
            const tm = tms[i];
            tm.stop();
        }

        tms = undefined;
    } else {
        tms = [];
        const ic = { h: 0.2, s: 0.9, v: 0.3 };
        for (let i = 0; i < bulbs.length; i++) {
            const tm = new trimod(bulbs[i]);
            tms.push(tm);
            tm.start(ic, 0.3, 0.7, 20000);
        }
    }

    res.send("fun?");
});

async function fun(n: number) {
    if (n == 1) {
        const face = bulbFromName("Face");
        if (face == undefined) return;
        const lamps = bulbs.filter((b) => b != face);

        let rep = 0;
        let i = 0;

        let t_on = 100;
        let t_off = 0;

        while (rep < 100) {
            face.set_power(true);
            await sleep(t_on);
            face.set_power(false);
            await sleep(t_off);

            const b = lamps[i % lamps.length];
            b.set_power(true);
            await sleep(t_on);
            b.set_power(false);
            await sleep(t_off);

            i += 1;
            rep += 1;
        }
    }

    if (n == 2) {
        lcs = [];
        const ic = { h: 0, s: 1, v: 1 };
        for (let i = 0; i < bulbs.length; i++) {
            const lc = new LightCycle(bulbs[i]);
            lcs.push(lc);
            lc.start(ic);
        }
    }
}

function bulbFromName(name: string): bulbDevice.Bulb {
    for (let i = 0; i < bulbs.length; i++) {
        const bulb = bulbs[i];
        if (bulb.name == name) return bulb;
    }
    return undefined;
}

let server = app.listen(1337);
