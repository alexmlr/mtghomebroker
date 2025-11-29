import { createReadStream } from 'fs';
import JSONStream from 'JSONStream';

const PRICES_FILE = 'e:\\Dev\\App - Boost Homebroker\\data\\AllPrices.json';

let count = 0;

const stream = createReadStream(PRICES_FILE, { encoding: 'utf-8' });
const parser = JSONStream.parse(['data', { emitKey: true }]);

parser.on('data', (entry: any) => {
    count++;

    if (count <= 3) {
        console.log(`\nEntry #${count}:`);
        console.log('Type:', typeof entry);
        console.log('entry:', JSON.stringify(entry).slice(0, 300));
    }

    if (count >= 10) {
        parser.end();
        stream.destroy();
    }
});

parser.on('end', () => {
    console.log(`\nTotal entries: ${count}`);
});

stream.pipe(parser);
