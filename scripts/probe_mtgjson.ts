
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const MTGJSON_API_TOKEN = process.env.MTGJSON_API_TOKEN;

if (!MTGJSON_API_TOKEN) {
    console.error('Usage: npx tsx scripts/probe_mtgjson.ts');
    process.exit(1);
}

const query = `query { cards(filter: { prices: { date: "2023-01-01" } }, page: { take: 10, skip: 0 }) { uuid } }`;

async function probe() {
    console.log(`Probing query: ${query}`);

    try {
        const response = await fetch('https://graphql.mtgjson.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MTGJSON_API_TOKEN}`
            },
            body: JSON.stringify({ query })
        });

        const data: any = await response.json();
        if (data.errors) {
            console.log('FAILED.');
            console.log('Error Message:', data.errors[0].message);
        } else {
            console.log('SUCCESS!');
            console.log('Data:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

probe();
