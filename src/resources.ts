import { Bulb } from './bulbdevice';
import { Resource } from './resource';

export class Resources extends Array<Resource> {
	getById(resId: string) {
		return super.find(r => r.id === resId);
	}

	getByResource(resource: Bulb) {
		return super.find(r => r.resource === resource);
	}

	getMatching(target: string): Resource[] {
		if (target.length > 0) {

			// this target string will use regex
			if (target[0] === "*") {
				const reg = RegExp(target.slice(1));
				return this.filter(r => reg.test(r.id));
			}

			else {
				const res = this.getById(target);
				if (res !== undefined)
					return [res];
			}
		}

		return [];
	}
}