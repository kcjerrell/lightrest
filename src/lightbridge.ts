import * as bulbDevice from "./bulbdevice";
import * as deviceInfo from './deviceInfo.json';

console.log("starting lightbridge...");

console.log('Loading devices...');
const devices = loadBulbs(deviceInfo.bulbs);
console.log(`${devices.length} devices found.`);

function loadBulbs(info: { id: string; key: string; ip: string; name: string; }[]) {
	const bs: bulbDevice.Bulb[] = [];

	for (const bi of info) {
			bulbDevice.TryGetBulb(bi).then((b) => bs.push(b));
	}

	return bs;
}