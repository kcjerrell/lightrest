

export interface LightDgram {
	verb: string;
	target: string;
	property: string;
	data: string;
}

export class DgramHelper {

	toString(): string {
		return 'not done';
	}

	static fromString(message: string): LightDgram {
		const seg = message.split(":");
		const dgram: LightDgram = {
			verb: seg[0],
			target: seg[1],
			property: seg[2],
			data: seg[3]
		};
		return dgram;
	}
}

export enum LightDgramProperty {
	None = "none",
	Id = "id",
	Name = "name",
	Power = "power",
	Mode = "mode",
	Brightness = "brightness",
	ColorTemp = "colortemp",
	Color = "color",
	Hue = "hue",
	Saturation = "saturation",
	Value = "value"
}

export enum DgramVerbs {
			None = "none",
			Tell = "tell",       // Inform remote of resource property
			Wonder = "wonder",     // Express interest in remote resource property
			Wish = "wish",       // Request a change in remote property
			Enloop = "enloop",     // Request to be updated of all changes in a remote resource property
}