import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const MTGJSON_API_TOKEN = process.env.MTGJSON_API_TOKEN!;

async function testUUIDs() {
    // Query for cards (used in populate_cards.ts)
    const cardsQuery = `
    query {
      cards(filter: {}, page: { take: 5, skip: 0 }, order: { order: ASC }) {
        uuid
        name
        setCode
        number
      }
    }
  `;

    // Query for prices (used in fetch_mtg_prices.ts)
    const pricesQuery = `
    query {
      cards(filter: {}, page: { take: 5, skip: 0 }, order: { order: ASC }) {
        name
        setCode
        number
        identifiers {
          mtgjsonV4Id
          scryfallId
        }
      }
    }
  `;

    console.log('=== Cards Query (populate_cards.ts) ===');
    const cardsResponse = await fetch('https://graphql.mtgjson.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MTGJSON_API_TOKEN}`
        },
        body: JSON.stringify({ query: cardsQuery })
    });
    const cardsData: any = await cardsResponse.json();
    console.log(JSON.stringify(cardsData.data.cards, null, 2));

    console.log('\n=== Prices Query (fetch_mtg_prices.ts) ===');
    const pricesResponse = await fetch('https://graphql.mtgjson.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MTGJSON_API_TOKEN}`
        },
        body: JSON.stringify({ query: pricesQuery })
    });
    const pricesData: any = await pricesResponse.json();
    console.log(JSON.stringify(pricesData.data.cards, null, 2));
}

testUUIDs().catch(console.error);
