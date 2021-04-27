import dgram = require('dgram');
import * as repl from 'repl'
import * as bulbDevice from "./bulbdevice";
import * as bulbInfoData from './deviceInfo.json';
import { log, setLevel } from './log';
import { LightDgram, LightDgramProperty, DgramVerbs } from './lightdgram';
import { HSV, hsv_to_hex } from './core';
import { Resources } from './resources';
import { Resource } from './resource';
import { TuyaToHSV } from './color';
import express = require('express');

const DEFAULTPORT = 8090;
const DEFAULTHOST = '127.0.0.1';
const USEMUSICMODE = false;
const LOADONE = false;

const bulbInfo = bulbInfoData.bulbs;

/**
 * Represents a UDP interface to Tuya-based LED lightbulbs
 */
export class UdpBridge {
	port: number;
	resources: Resources;
	address: string;
	server: dgram.Socket;
	client: dgram.RemoteInfo;

	constructor() {
		this.server = dgram.createSocket('udp4');
		this.resources = new Resources();
	}

	/**
	 * Opens a socket on the specified port and address
	 * Registers handlers for "listening" and "message" events
	 *
	 * @param port the port to use
	 * @param address the local address
	 */
	bind(port: number, address: string) {
		this.port = port;
		this.address = address;

		this.server.on('listening', () => {
			log('UDP Server listening on ' + this.server.address().address + ':' + this.server.address().port, 4);
		});

		this.server.on('message', (message, remote) => {
			this.receiveMessage(message.toString(), remote);
		});

		this.server.bind(this.port, this.address);
	}

	/**
	 * Callback for socket server "message" event
	 *
	 * @param message the message receieved
	 * @param remote the address and port for the client
	 */
	receiveMessage(message: string, remote: dgram.RemoteInfo) {
		log(remote.address + ":" + remote.port + " - " + message, 1);

		if (this.client === undefined) {
			this.client = remote;
		}

		this.processMessage(message, remote);
	}

	sendMessage(msg: string, remote: dgram.RemoteInfo) {
		log(`sending message: ${msg}  ${remote.address}:${remote.port}`, 2)
		this.server.send(msg, remote.port, remote.address);
	}

	async loadResources(info: { id: string; key: string; ip: string; name: string; }[]) {
		for (const bi of info) {
			await bulbDevice.TryGetBulb(bi).then((res) => {

				const resId = `bulb-${this.resources.length + 1}`;

				const resource = new Resource(resId, res);
				this.resources.push(resource);

				res.on('propertychanged', (prop: LightDgramProperty, value: any) => {
					this.updateLoop(resource, prop);
				});
			}, (reason) => {
				log(reason, 5);
			});

			if (LOADONE)
				break;
		}
	}

	updateLoop(res: Resource, prop: LightDgramProperty) {
		// for (const w of res.watchers) {
		if (this.client !== undefined)
			this.tell(this.client, res, prop);
		//  }
	}

	tell(remote: dgram.RemoteInfo, res: Resource, prop: string) {
		if (prop === LightDgramProperty.Name) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Name}:${res.resource.name}`, remote)
		}
		else if (prop === LightDgramProperty.Power) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Power}:${res.resource.pow}`, remote)
		}
		else if (prop === LightDgramProperty.Color) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Color}:${encodeColor(res.resource.col)}`, remote)
		}
		else if (prop === LightDgramProperty.Mode) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Mode}:${res.resource.mode}`, remote)
		}
		else if (prop === LightDgramProperty.Brightness) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Brightness}:${res.resource.brightness}`, remote)
		}
		else if (prop === LightDgramProperty.ColorTemp) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.ColorTemp}:${res.resource.colortemp}`, remote)
		}
	}

	onWish(res: Resource, data: string[]) {
		const props = data.map(d => {
			const split = d.split("=");
			return { property: split[0], value: split[1] };
		});

		res.resource.qset(props);
	}

	// for (const pv of props) {

	// 	if (pv.property === LightDgramProperty.Power) {
	// 		const value = (/true/i).test(pv.value);
	// 		// if (res.resource.pow !== value)
	// 		res.resource.qset(LightDgramProperty.Power, value);
	// 	}

	// 	else if (pv.property === LightDgramProperty.Color) {
	// 		const value = decodeColor(pv.value);
	// 		// if (res.resource.col !== value)
	// 		if (USEMUSICMODE)
	// 			res.resource.qset(LightDgramProperty.Music, `0ffffffffffff00000000`);
	// 		// res.resource.qset(LightDgramProperty.Music, `0${hsv_to_hex(value)}00000000`);
	// 		else
	// 			res.resource.qset(LightDgramProperty.Color, hsv_to_hex(value));
	// 	}

	// 	else if (pv.property === LightDgramProperty.Mode) {
	// 		// if (res.resource.mode !== data)
	// 		const mode = bulbDevice.Bulb.validateMode(pv.value);
	// 		if (mode)
	// 			res.resource.qset(LightDgramProperty.Mode, mode);
	// 	}

	// 	else if (pv.property === LightDgramProperty.Brightness) {
	// 		const value = parseFloat(pv.value);
	// 		// if (res.resource.brightness !== value)
	// 		res.resource.qset(LightDgramProperty.Brightness, value);
	// 	}

	// 	else if (pv.property === LightDgramProperty.ColorTemp) {
	// 		const value = parseFloat(pv.value);
	// 		// if (res.resource.colortemp !== value)
	// 		res.resource.qset(LightDgramProperty.ColorTemp, value);
	// 	}
	// }
	//  }

	enloop(remote: dgram.RemoteInfo, res: Resource) {
		// res.addWatcher(remote);

		this.client = remote;

		const props = [LightDgramProperty.Power, LightDgramProperty.Color, LightDgramProperty.Mode, LightDgramProperty.Brightness, LightDgramProperty.ColorTemp];
		for (const prop of props) {
			this.tell(remote, res, prop);
		}
	}

	processMessage(msg: string, remote: dgram.RemoteInfo) {
		const split = msg.split(":");

		const verb: string = split[0];
		const target = this.resources.getMatching(split[1]);
		// const property = split[2];
		// const data = split[3];

		log(`msg received: ${msg} from ${remote.address}:${remote.port}`, 1);

		for (const t of target) {
			switch (verb) {
				case DgramVerbs.Wonder:
					this.tell(remote, t, split[2]);
					break;

				case DgramVerbs.Wish:
					this.onWish(t, split.slice(2));
					break;

				case DgramVerbs.Enloop:
					this.enloop(remote, t);
					break;

				default:
					break;
			}
		}
	}
}


const bridge = new UdpBridge();
bridge.loadResources(bulbInfo);
bridge.bind(DEFAULTPORT, DEFAULTHOST);



function encodeColor(color: HSV) {
	return `h${color.h}s${color.s}v${color.v}`;
}

function decodeColor(colorText: string): HSV {
	const matches = colorText.match(/h([0-9.]+)s([0-9.]+)v([0-9.]+)/);
	const h = parseFloat(matches[1]);
	const s = parseFloat(matches[2]);
	const v = parseFloat(matches[3]);
	return { h, s, v };
}

// const app = express();

// app.set("json spaces", 4);

// app.get('/m/:data', (req, res) => {
// 	// }
// });

// app.listen(1337);



const r = repl.start('> ');

// r.context.app = app;
r.context.bridge = bridge;
r.context.bulbInfo = bulbInfo;
r.context.setLevel = setLevel;


// function sendDgrams(dgrams: LightDgram[], targetClient: Client) {
// 	for (const d of dgrams) {
// 		server.send(d.toString(), targetClient.port, targetClient.address);
// 	}
// }
//
// interface ClientX {
// 	address: string,
// 	port: number
// }
//
// interface ResourceX {
// 	resId: string,
// 	res: bulbDevice.Bulb,
// 	watchers: dgram.RemoteInfo[]
// }
//
// function loadBulbs(info: { id: string; key: string; ip: string; name: string; }[]) {
// 	const bs: bulbDevice.Bulb[] = [];
//
// 	for (const bi of info) {
// 		const bulb = bulbDevice.TryGetBulb(bi).then((b) => {
// 			bs.push(b);
// 			const resId = `bulb-${bs.length}`;
// 			resourcesX[resId] = b;
// 			b.on('propertychanged', (prop: LightDgramProperty, value: any) => {
// 				tell({ resId, res: resourcesX[resId] }, prop, client);
// 			});
// 		});
// 		break;
// 	}
// tslint:disable-next-line: no-trailing-whitespace
//
// 	return bs;
// }
// function ProcessMessage(message: Buffer, remote: dgram.RemoteInfo) {
// 	const msg = message.toString();
// 	const split = msg.split(":");

// 	const verb: string = split[0];
// 	const target: Resource[] = findTargets(split[1]);
// 	const property = split[2];
// 	const data = split[3];

// 	console.log(`msg received: ${msg}`);
// 	// console.log(`    ${verb} ... ${target} ... ${property} ... ${data}`)

// 	for (const t of target) {
// 		switch (verb) {
// 			case DgramVerbs.Wonder:
// 				tell(t, property, remote);
// 				break;

// 			case DgramVerbs.Wish:
// 				onWish(t, property, data, remote);
// 				break;

// 			case DgramVerbs.Enloop:
// 				break;

// 			default:
// 				break;
// 		}
// 	}
// }

// function tell(target: Resource, property: string, remote: dgram.RemoteInfo) {
// 	if (property === LightDgramProperty.Name) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.Name}:${target.res.name}`, remote)
// 	}
// 	else if (property === LightDgramProperty.Power) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.Power}:${target.res.pow}`, remote)
// 	}
// 	else if (property === LightDgramProperty.Color) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.Color}:${encodeColor(target.res.col)}`, remote)
// 	}
// 	else if (property === LightDgramProperty.Mode) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.Mode}:${target.res.mode}`, remote)
// 	}
// 	else if (property === LightDgramProperty.Brightness) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.Brightness}:${target.res.brightness}`, remote)
// 	}
// 	else if (property === LightDgramProperty.ColorTemp) {
// 		sendMessage(`tell:${target.resId}:${LightDgramProperty.ColorTemp}:${target.res.colortemp}`, remote)
// 	}
// }

// function onWish(target: Resource, property: string, data: string, remote: dgram.RemoteInfo) {
// 	if (property === LightDgramProperty.Power) {
// 		target.res.set_power((/true/i).test(data));
// 	}
// 	else if (property === LightDgramProperty.Color) {
// 		target.res.set_color(decodeColor(data));
// 	}
// 	else if (property === LightDgramProperty.Mode) {
// 		target.res.set_mode(data);
// 	}
// 	else if (property === LightDgramProperty.Brightness) {
// 		target.res.set_brightness(parseFloat(data));
// 	}
// 	else if (property === LightDgramProperty.ColorTemp) {
// 		target.res.set_warmth(parseFloat(data));
// 	}
// }

// function findTargets(target: string): Resource[] {
// 	const match = [];

// 	if (target.length > 0) {

// 		// this target string will use regex
// 		if (target[0] === "*") {
// 			const reg = RegExp(target.slice(1));
// 			for (const resId in resourcesX) {
// 				if (Object.prototype.hasOwnProperty.call(resourcesX, resId)) {
// 					const res = resourcesX[resId];
// 					if (reg.test(resId))
// 						match.push({ resId, res });
// 				}
// 			}
// 		}

// 		else {
// 			if (resourcesX.hasOwnProperty(target))
// 				match.push({ resId: target, res: resourcesX[target] });
// 		}
// 	}

// 	return match;
// }

// function getResourceId(resource) {
// 	for (const key in resourcesX) {
// 		if (Object.prototype.hasOwnProperty.call(resourcesX, key)) {
// 			const res = resourcesX[key];
// 			if (res === resource)
// 				return key;
// 		}
// 	}
// 	return "";
// }

