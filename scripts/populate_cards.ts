import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const MTGJSON_API_TOKEN = process.env.MTGJSON_API_TOKEN!;
const BATCH_SIZE = 100;
const DELAY_MS = 8000; // 8 seconds delay to stay under 500 req/h (approx 450 req/h)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CardIdentifiers {
    scryfallId?: string;
}

interface MTGJSONCard {
    uuid: string;
    name: string;
    setCode: string;
    number: string;
    hasFoil: boolean;
    hasNonFoil: boolean;
    identifiers: CardIdentifiers;
    set: {
        name: string;
    };
}

async function fetchCardsPage(take: number, skip: number): Promise<MTGJSONCard[]> {
    const query = `
    query FetchCards($take: Int!, $skip: Int!) {
      cards(
        filter: {}
        page: { take: $take, skip: $skip }
        order: { order: ASC }
      ) {
        uuid
        name
        setCode
        number
        hasFoil
        hasNonFoil
        identifiers {
          scryfallId
        }
        set {
          name
        }
      }
    }
  `;

    const response = await fetch('https://graphql.mtgjson.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MTGJSON_API_TOKEN}`
        },
        body: JSON.stringify({ query, variables: { take, skip } })
    });

    const data: any = await response.json();

    if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error('GraphQL query failed');
    }

    return data.data.cards || [];
}

async function main() {
    console.log('Starting cards population...');
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Delay between batches: ${DELAY_MS}ms`);

    let skip = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
        console.log(`Fetching batch: skip=${skip}, take=${BATCH_SIZE}`);
        const startTime = Date.now();

        try {
            const cards = await fetchCardsPage(BATCH_SIZE, skip);

            if (cards.length === 0) {
                hasMore = false;
                console.log('No more cards to fetch.');
                break;
            }

            const rowsToInsert: any[] = [];

            for (const card of cards) {
                // Prepare base data
                const baseData = {
                    mtgjson_uuid: card.uuid,
                    scryfall_id: card.identifiers.scryfallId || null,
                    name: card.name,
                    set_name: card.set.name,
                    set_code: card.setCode,
                    collector_number: card.number,
                    collector_number_normalized: card.number, // Simple normalization for now
                    imported_at: new Date().toISOString()
                };

                // If non-foil exists
                if (card.hasNonFoil) {
                    rowsToInsert.push({
                        ...baseData,
                        is_foil: false
                    });
                }

                // If foil exists
                if (card.hasFoil) {
                    rowsToInsert.push({
                        ...baseData,
                        is_foil: true
                    });
                }
            }

            // Deduplicate rows based on unique constraint keys
            const uniqueRows = new Map<string, any>();
            for (const row of rowsToInsert) {
                const key = `${row.set_code}-${row.collector_number_normalized}-${row.is_foil}`;
                if (!uniqueRows.has(key)) {
                    uniqueRows.set(key, row);
                }
            }
            const finalRows = Array.from(uniqueRows.values());

            if (finalRows.length > 0) {
                const { error } = await supabase
                    .from('cards')
                    .upsert(finalRows, {
                        onConflict: 'set_code,collector_number_normalized,is_foil',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error('Supabase Error:', error);
                } else {
                    console.log(`Upserted ${finalRows.length} rows.`);
                }
            }

            totalProcessed += cards.length;
            skip += BATCH_SIZE;

            // Rate limiting delay
            const elapsed = Date.now() - startTime;
            const waitTime = Math.max(0, DELAY_MS - elapsed);

            if (hasMore && waitTime > 0) {
                console.log(`Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

        } catch (error) {
            console.error('Error in batch:', error);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log('Population complete!');
    console.log(`Total cards processed from API: ${totalProcessed}`);
}

main().catch(console.error);
