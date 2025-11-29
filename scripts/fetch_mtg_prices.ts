import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { writeFileSync, existsSync } from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const MTGJSON_API_TOKEN = process.env.MTGJSON_API_TOKEN!;
const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';
const UNMATCHED_LOG = 'unmatched_cards.csv';
const DELAY_MS = 8000;
const MAX_BATCHES = process.env.MAX_BATCHES ? parseInt(process.env.MAX_BATCHES) : undefined;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CardPrice {
    provider: string;
    date: string;
    cardType: string;
    listType: string;
    price: number;
}

interface MTGJSONCard {
    name: string;
    setCode: string;
    number: string;
    prices: CardPrice[];
}

const stats = {
    cardsProcessed: 0,
    pricesInserted: 0,
    cardsUpdated: 0,
    unmatchedCards: 0,
    fxRatesFetched: 0
};

const fxRateCache = new Map<string, number>();

async function getFxRateForDate(date: string): Promise<number> {
    if (fxRateCache.has(date)) {
        return fxRateCache.get(date)!;
    }

    const { data: cachedRate } = await supabase.from('fx_rates').select('rate')
        .eq('pair', 'USD_BRL').eq('fetched_at', date).single();

    if (cachedRate) {
        fxRateCache.set(date, cachedRate.rate);
        return cachedRate.rate;
    }

    console.log(`Fetching FX rate for ${date}...`);
    const response = await fetch(`https://api.exchangerate.host/${date}?base=USD&symbols=BRL`);
    const data: any = await response.json();
    const rate = data.rates?.BRL;

    if (!rate) throw new Error('Rate not found');

    if (!DRY_RUN) {
        await supabase.from('fx_rates').insert({
            pair: 'USD_BRL', rate, fetched_at: date, source: 'exchangerate.host'
        });
    }

    fxRateCache.set(date, rate);
    stats.fxRatesFetched++;
    return rate;
}

function logUnmatchedCard(card: MTGJSONCard, reason: string) {
    const line = `${card.setCode},${card.number},${card.name},${reason}\n`;
    if (!existsSync(UNMATCHED_LOG)) {
        writeFileSync(UNMATCHED_LOG, 'set_code,collector_number,name,reason\n');
    }
    writeFileSync(UNMATCHED_LOG, line, { flag: 'a' });
    stats.unmatchedCards++;
}

async function processCard(card: MTGJSONCard) {
    const { data: cardVariants } = await supabase
        .from('cards')
        .select('id, is_foil')
        .eq('set_code', card.setCode)
        .eq('collector_number_normalized', card.number);

    if (!cardVariants || cardVariants.length === 0) {
        logUnmatchedCard(card, `Not found: ${card.setCode} #${card.number}`);
        return;
    }

    const ckPrices = card.prices.filter(p => p.provider === 'cardkingdom');
    if (ckPrices.length === 0) return;

    for (const priceData of ckPrices) {
        const { date, cardType, listType, price: priceRaw } = priceData;
        const isFoilPrice = cardType === 'foil' || cardType === 'etched';
        const matchingCard = cardVariants.find(v => v.is_foil === isFoilPrice);

        if (!matchingCard) continue;

        const fxRate = await getFxRateForDate(date);
        const priceBrl = (priceRaw * fxRate) + 0.30;
        const priceType = listType === 'buylist' ? 'buy' : 'sell';

        if (DRY_RUN) {
            console.log(`[DRY] ${card.name} (${card.setCode} #${card.number}) [${isFoilPrice ? 'FOIL' : 'NORMAL'}] | ${date} | ${priceType}: $${priceRaw} -> R$${priceBrl.toFixed(2)}`);
            continue;
        }

        await supabase.from('price_history').upsert({
            card_id: matchingCard.id,
            source: 'CardKingdom',
            price_type: priceType,
            price_raw: priceRaw,
            currency: 'USD',
            fx_rate_to_brl: fxRate,
            price_brl: priceBrl,
            scraped_at: date
        }, { onConflict: 'card_id,source,scraped_at' });

        stats.pricesInserted++;

        const updateData: any = { ck_last_update: date };
        if (priceType === 'buy') {
            updateData.ck_buy_usd = priceRaw;
            updateData.ck_buy_brl = priceBrl;
        } else {
            updateData.ck_retail_usd = priceRaw;
            updateData.ck_retail_brl = priceBrl;
        }
        await supabase.from('cards').update(updateData).eq('id', matchingCard.id);
    }
    stats.cardsUpdated++;
}

async function fetchCardsPage(take: number, skip: number): Promise<MTGJSONCard[]> {
    const query = `
    query FetchCardsWithPrices($take: Int!, $skip: Int!) {
      cards(filter: {}, page: { take: $take, skip: $skip }, order: { order: ASC }) {
        name
        setCode
        number
        prices {
          provider
          date
          cardType
          listType
          price
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
    console.log(`Starting MTGJSON price sync... (Dry Run: ${DRY_RUN})`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Delay between batches: ${DELAY_MS}ms`);
    if (MAX_BATCHES) console.log(`TEST MODE: Limited to ${MAX_BATCHES} batch(es)`);

    let skip = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore && (!MAX_BATCHES || batchCount < MAX_BATCHES)) {
        console.log(`\nFetching batch ${batchCount + 1}${MAX_BATCHES ? `/${MAX_BATCHES}` : ''}: skip=${skip}, take=${BATCH_SIZE}`);
        const startTime = Date.now();

        try {
            const cards = await fetchCardsPage(BATCH_SIZE, skip);

            if (cards.length === 0) {
                hasMore = false;
                console.log('No more cards.');
                break;
            }

            console.log(`Processing ${cards.length} cards...`);

            for (const card of cards) {
                try {
                    await processCard(card);
                    stats.cardsProcessed++;
                } catch (error) {
                    console.error(`Error processing card ${card.name} (${card.setCode} #${card.number}):`, error);
                    throw error;
                }
            }

            skip += BATCH_SIZE;
            batchCount++;

            const elapsed = Date.now() - startTime;
            const waitTime = Math.max(0, DELAY_MS - elapsed);

            if (hasMore && waitTime > 0 && (!MAX_BATCHES || batchCount < MAX_BATCHES)) {
                console.log(`Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        } catch (error) {
            console.error('Error in batch:', error);
            break;
        }
    }

    console.log('\n=== Sync Result ===');
    console.log(`Cards processed: ${stats.cardsProcessed}`);
    console.log(`Prices inserted: ${stats.pricesInserted}`);
    console.log(`Cards updated: ${stats.cardsUpdated}`);
    console.log(`Unmatched cards: ${stats.unmatchedCards}`);
    console.log(`FX rates fetched: ${stats.fxRatesFetched}`);

    if (stats.unmatchedCards > 0) {
        console.log(`\nUnmatched cards logged to: ${UNMATCHED_LOG}`);
    }
}

main().catch(console.error);
