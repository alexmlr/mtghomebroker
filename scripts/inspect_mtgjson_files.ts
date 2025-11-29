import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function inspectPrices() {
    console.log('=== Inspecting AllPrices.json (first 20KB) ===');

    const stream = createReadStream('e:\\Dev\\App - Boost Homebroker\\data\\AllPrices.json', {
        encoding: 'utf-8',
        start: 0,
        end: 20000
    });

    let content = '';
    for await (const chunk of stream) {
        content += chunk;
    }

    console.log('First 2000 chars:');
    console.log(content.slice(0, 2000));

    // Try to extract first UUID pattern
    const uuidMatch = content.match(/"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})":/);
    if (uuidMatch) {
        console.log('\n✅ Found UUID pattern:', uuidMatch[1]);
    }
}

async function inspectPrintings() {
    console.log('\n=== Inspecting AllPrintings.json (first 50KB) ===');

    const stream = createReadStream('e:\\Dev\\App - Boost Homebroker\\data\\AllPrintings.json', {
        encoding: 'utf-8',
        start: 0,
        end: 50000
    });

    let content = '';
    for await (const chunk of stream) {
        content += chunk;
    }

    console.log('First 3000 chars:');
    console.log(content.slice(0, 3000));

    // Look for uuid and mtgjsonV4Id
    const uuidMatch = content.match(/"uuid":\s*"([a-f0-9-]+)"/);
    const v4Match = content.match(/"mtgjsonV4Id":\s*"([a-f0-9-]+)"/);

    if (uuidMatch) {
        console.log('\n✅ Found "uuid" field:', uuidMatch[1]);
    }
    if (v4Match) {
        console.log('✅ Found "mtgjsonV4Id" field:', v4Match[1]);
    }
}

async function main() {
    await inspectPrices();
    await inspectPrintings();
}

main().catch(console.error);
