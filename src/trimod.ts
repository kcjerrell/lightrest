import { Bulb } from './bulbdevice';
import { HSV } from './core';

export class trimod {
    bulb: Bulb;
    increasing = true;
    interval: number;
    v: number;
    v_min: number;
    v_max: number;
    timer: NodeJS.Timeout;

    constructor(bulb: Bulb) {
        this.bulb = bulb;
    }

    start(init_color: HSV, v_min: number, v_max: number, t: number) {
        return new Promise<void>(async (resolve, reject) => {
            this.v_min = v_min;
            this.v_max = v_max;
            this.v = v_min * 1000;

            let v_range = (v_max - v_min) * 1000;
            this.interval = t / v_range;
            this.increasing = true;

            await this.bulb.set_power(true);
            await this.bulb.set_color({ h: init_color.h, s: init_color.s, v: this.v });

            this.timer = setInterval((x: trimod) => {
                if (x.increasing) {
                    x.v += 1;

                    if (x.v >= x.v_max)
                        x.increasing = false;
                }
                else {
                    x.v -= 1;

                    if (x.v <= x.v_min)
                        x.increasing = true;
                }

                x.bulb.set_color({ h: -1, s: -1, v: x.v / 1000 });

            }, this.interval, this);

            resolve();
        });
    }

    stop() {
        clearInterval(this.timer);
    }
}