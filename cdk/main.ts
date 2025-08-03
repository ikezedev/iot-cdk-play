import { Humidity } from './protos/types.ts';

function main() {
    const test = Uint8Array.from([10, 17, 104, 117, 109, 105, 100, 105, 116, 121, 95, 115, 101, 110, 115, 111, 114, 95, 49, 21, 0, 0, 52, 66, 24, 187, 193, 163, 136, 135, 51]);
    const humidity = Humidity.fromBinary(test);
    console.log(typeof humidity.timestamp);
}
main()

// 