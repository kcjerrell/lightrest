import { Bulb } from "./bulbdevice";
import { HSV, rand, rand_gap } from "./core";

let h_min = 0;
let h_max = 0.1;
let s_min = 0.85;
let s_max = 0.9;
let v_min = 0.2;
let v_max = 0.5;
let v_step = 0.15;
let t_min = 100;
let t_max = 500;

export class LightCycle {
    bulb: Bulb;
    last_v: number;
    keep_running: boolean = false;

    constructor(bulb: Bulb) {
        this.bulb = bulb;
    }

    async start(init_color: HSV) {
        return new Promise<void>(async (resolve, reject) => {
            console.log(`starting new lc ${this.bulb.name}`);

            await this.bulb.set_power(true);
            console.log(`power set ${this.bulb.name}`)
            await this.bulb.set_color(init_color);
            console.log(`color set ${this.bulb.name}`)

            this.keep_running = true;
            this.last_v = init_color.v;
            this.proc();

            resolve();
        });
    }

    async proc() {
        if (!this.keep_running)
            return;

        let color = this.next_color();
        this.last_v = color.v;

        this.bulb.set_color(color);
        setTimeout((x) => x.proc(), rand(t_min, t_max), this);
    }

    next_color(): HSV {
        let h = rand(h_min, h_max) % 1;
        let s = rand(s_min, s_max);
        let v = rand_gap(v_min, v_max, this.last_v - v_step, this.last_v + v_step);

        return { h: h, s: s, v: v };
    }

    stop() {
        this.keep_running = false;
    }
}