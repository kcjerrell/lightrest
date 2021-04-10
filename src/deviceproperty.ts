import * as bulbdevice from "./bulbdevice"
import * as querystring from "querystring"

export class DeviceProperty {
    name: string;
    dps: number;
    device : bulbdevice.Bulb
    format_response: (data: object) => object
    
    default_format_response(data: object): object {
        return data;;
    } 

    constructor(name, dps, device) {
        this.name = name;
        this.dps = dps;
        this.device = device;
        this.format_response = this.default_format_response;
    }

    async get(device: bulbdevice.Bulb) {
       return await device.get({dps: this.dps});
    }

    set(device: bulbdevice.Bulb, query: object) {
        
    }
}

export interface getPropertyOptions {
    dps: number
}

export class DevicePropertyCollection {    
    properties: Map<string, DeviceProperty> = new Map<string, DeviceProperty>()

    add(property: DeviceProperty)
    {
        this.properties[property.name] = property;
    }

    async try_get_property(name: string, device: bulbdevice.Bulb) {
        if (this.properties.has(name)) {
            return await this.properties[name].get(device);
        }
    }

    async try_set_property(name: string, query: object, device: bulbdevice.Bulb)
    {
        if (this.properties.has(name)) {
            
        }
    }
}