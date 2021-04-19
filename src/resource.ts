import { Bulb } from "./bulbdevice"
import dgram = require('dgram');
import { LightDgramProperty } from "./lightdgram";
import { UdpBridge } from "./sockets";

export class Resource {
	id: string;
	resource: Bulb;
	watchers: dgram.RemoteInfo[] = [];
	bridge: UdpBridge;

	constructor(resourceId: string, resource: Bulb) {
		this.id = resourceId;
		this.resource = resource;
	}

	addWatcher(remote: dgram.RemoteInfo) {
		this.watchers.push(remote);
	}

	removeWatcher(remote: dgram.RemoteInfo) {
		const index = this.watchers.indexOf(remote);
		this.watchers.splice(index, 1);
	}
}

