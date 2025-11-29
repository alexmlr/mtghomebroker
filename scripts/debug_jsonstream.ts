import { createReadStream } from 'fs';
import JSONStream from 'JSONStream';

const PRICES_FILE = 'e:\\Dev\\App - Boost Homebroker\\data\\AllPrices.json';

let count = 0;

const stream = createReadStream(PRICES_FILE, { encoding: 'utf-8' });
const parser = JSONStream.parse('data.*');

parser.on('data', (entry: any) => {
    count++;

    if (count <= 3) {
        console.log(`\nEntry #${count}:`);
        console.log('Type:', typeof entry);
        console.log('Is Object:', typeof entry === 'object' && entry !== null);
        console.log('Has key:', 'key' in entry);
        console.log('Has value:', 'value' in entry);
        console.log('Object keys:', Object.keys(entry).slice(0, 10));
        console.log('Sample:', JSON.stringify(entry).slice(0, 500));
    }

    if (count >= 10) {
        parser.end();
        stream.destroy();
    }
});

parser.on('end', () => {
    console.log(`\nTotal entries: ${count}`);
});

parser.on('error', (err: any) => {
    console.error('Error:', err);
});

stream.pipe(parser);
