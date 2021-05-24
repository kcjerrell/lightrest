import dgram = require('dgram');
import * as repl from 'repl'
import * as bulbDevice from "./bulbdevice";
import * as bulbInfoData from './deviceInfo.json';
import { log, setLevel } from './log';
import { LightDgram, LightDgramProperty, DgramVerbs } from './lightdgram';
import { HSV, hsvToTuya } from './core';
import { Resources } from './resources';
import { Resource } from './resource';
import express = require('express');

const DEFAULTPORT = 8090;
const DEFAULTHOST = '127.0.0.1';
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
	resIdsAssigned = 0;

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
		log(`Message from ${remote.address}:${remote.port} - ${message}`, 1)

		// if (this.client === undefined) {
		// 	this.client = remote;
		// }

		this.processMessage(message, remote);
	}

	/**
	 * Sends a message to the specified address
	 *
	 * @param msg message to send
	 * @param remote client address
	 */
	sendMessage(msg: string, remote: dgram.RemoteInfo) {
		log(`sending message to ${remote.address}:${remote.port} - ${msg}`, 2)
		this.server.send(msg, remote.port, remote.address);
	}

	/**
	 * Loads the devices specified by the provided info
	 * Subscribes to their "propertychanged" event
	 *
	 * @param info array of device info
	 */
	async loadResources(info: { id: string; key: string; ip: string; name: string; }[]) {
		for (const bi of info) {
			const resId = `bulb-${++this.resIdsAssigned}`;

			await bulbDevice.TryGetBulb(bi).then((res) => {
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

	/**
	 * Callback for device resources "propertychanged" event
	 * sends a message to the "client" describing the property change
	 *
	 * @param res the updated resource
	 * @param prop the updated property
	 */
	updateLoop(res: Resource, prop: LightDgramProperty) {
		if (this.client !== undefined)
			this.tell(this.client, res, prop);
	}

	/**
	 * Sends a TELL message to the client describe a resource property state
	 *
	 * @param remote the client to send the message to
	 * @param res the device resource
	 * @param prop the property being described
	 */
	tell(remote: dgram.RemoteInfo, res: Resource, prop: string) {
		if (prop === LightDgramProperty.Name) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Name}:${res.resource.name}`, remote)
		}
		else if (prop === LightDgramProperty.Id) {
			this.sendMessage(`tell:${res.id}:${LightDgramProperty.Id}:${res.resource.device.id}`, remote)
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

	/**
	 * Called when a "WISH" message is received. Triggers property change on the resource
	 *
	 * @param res the related device resource
	 * @param data the request data
	 */
	onWish(res: Resource, data: string[]) {
		const props = data.map(d => {
			const split = d.split("=");
			const property = split[0];

			return { property, value: split[1] };
		});

		res.resource.qset(props);
	}

	/**
	 * Subscribes a client to be notified when properties on the specified resource change
	 *
	 * @param remote the client info
	 * @param res the requested device resource
	 */
	async enloop(remote: dgram.RemoteInfo, res: Resource) {
		this.client = remote;
		log(`enlooping ${res.resource.name}`, 3);
		res.resource.get({ schema: true }).then(d => {
			log(`then ${res}`, 3);
			const props = [LightDgramProperty.Power, LightDgramProperty.Color, LightDgramProperty.Mode, LightDgramProperty.Brightness, LightDgramProperty.ColorTemp];
			for (const prop of props) {
				this.tell(remote, res, prop);
			}
		});
	}

	/**
	 * Parses a message and calls the appropriate functions
	 *
	 * @param msg the message to be parsed
	 * @param remote the sending client
	 */
	processMessage(msg: string, remote: dgram.RemoteInfo) {
		const split = msg.split(":");

		if (split[1] === 'bridge') {
			this.processBridgeMessage(split, remote);
			return;
		}

		const verb: string = split[0];
		const target = this.resources.getMatching(split[1]);

		if (verb === DgramVerbs.Holler) {
			this.client = remote;
			this.sendMessage("holler:::", remote)
		}

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

	processBridgeMessage(split: string[], remote: dgram.RemoteInfo) {
		const verb = split[0];

		if (verb === 'reload') {
			const notloaded = bulbInfo.filter(bi => bridge.resources.find(r => r.resource.id === bi.id) === undefined);
			bridge.loadResources(notloaded).then(() => {
				this.resources.forEach(res => {
					this.tell(remote, res, LightDgramProperty.Id);
				});
			});
		}
	}
}


const bridge = new UdpBridge();
bridge.loadResources(bulbInfo).then(() => {
	const notloaded = bulbInfo.filter(bi => bridge.resources.find(r => r.resource.id === bi.id) === undefined);
	console.log(notloaded);
	bridge.loadResources(notloaded);
});
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

const r = repl.start('> ');

r.context.bridge = bridge;
r.context.bulbInfo = bulbInfo;
r.context.setLevel = setLevel;

