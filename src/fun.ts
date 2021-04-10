import * as bd from "./bulbdevice";
import { interpolate_colors } from "./color";

let dev: fbulb[] = [];
let stepi: number = 0;
const bulbSelectionChance = .1;

export function start(bulbs: bd.Bulb[]) {
    bulbs.forEach(b => {
        dev.push(new fbulb(b));
    });

    setInterval(() => step(), 1000);
}

function step() {
    let v = stepi % 2 == 0 ? .8 : .5;
  
    //dev.forEach(b => {
    //    b.set_color({h: .5, s: .7, v: v});
    //});

    let di = Math.floor(Math.random() * dev.length);

    dev[di].step();

    stepi += 1;
}

class fbulb {
    i: number = 0;
    bulb: bd.Bulb;

    constructor(bulb: bd.Bulb) {
        this.bulb = bulb;
    }

    step() {
        let v = this.i % 2 == 0 ? .8 : .5;
        this.bulb.set_color({h: .5, s: .7, v: v});
        this.i += 1;
    }
}

function randBulbs(): bd.Bulb[] {
    let bulbs = [];

    for (let i = 0; i < dev.length; i++) {
        if (Math.random() <= bulbSelectionChance) {
            bulbs.push(dev[i]);
        }
    }

    return bulbs;
}