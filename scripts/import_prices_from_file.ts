import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createReadStream } from 'fs';
import JSONStream from 'JSONStream';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const DRY_RUN = process.env.DRY_RUN === 'true';
const PRICES_FILE = 'e:\\Dev\\App - Boost Homebroker\\data\\AllPrices.json';
const BATCH_SIZE = 100;
const MAX_CARDS = process.env.MAX_CARDS ? parseInt(process.env.MAX_CARDS) : undefined;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const stats = {
    cardsProcessed: 0,
    pricesInserted: 0,
    cardsUpdated: 0,
    unmatchedCards: 0,
    fxRatesFetched: 0,
    skippedNoPrice: 0
};

const fxRateCache = new Map<string, number>();

// Convert compact UUID to standard format
function normalizeUuid(compactUuid: string): string {
    if (compactUuid.length !== 32) {
        throw new Error(`Invalid compact UUID length: ${compactUuid}`);
    }
    return `${compactUuid.slice(0, 8)}-${compactUuid.slice(8, 12)}-${compactUuid.slice(12, 16)}-${compactUuid.slice(16, 20)}-${compactUuid.slice(20)}`;
}

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

    const response = await fetch(`https://api.exchangerate.host/${date}?base=USD&symbols=BRL`);
    const data: any = await response.json();
    const rate = data.rates?.BRL;

    if (!rate) {
        return 5.0; // Fallback
    }

    if (!DRY_RUN) {
        await supabase.from('fx_rates').insert({
            pair: 'USD_BRL', rate, fetched_at: date, source: 'exchangerate.host'
        });
    }

    fxRateCache.set(date, rate);
    stats.fxRatesFetched++;
    return rate;
}

async function processCardPrices(compactUuid: string, priceData: any) {
    try {
        const normalizedUuid = normalizeUuid(compactUuid);

        const { data: cardVariants, error } = await supabase
            .from('cards')
            .select('id, is_foil, name, set_code')
            .eq('mtgjson_uuid', normalizedUuid);

        if (error || !cardVariants || cardVariants.length === 0) {
            stats.unmatchedCards++;
            return;
        }

        const cardKingdomData = priceData?.paper?.cardkingdom;
        if (!cardKingdomData) {
            stats.skippedNoPrice++;
            return;
        }

        const buylistData = cardKingdomData.buylist || {};
        const retailData = cardKingdomData.retail || {};

        for (const variant of cardVariants) {
            const finish = variant.is_foil ? 'foil' : 'normal';

            // Process buylist prices
            const buyPrices = buylistData[finish] || {};
            for (const [date, priceRaw] of Object.entries(buyPrices)) {
                if (typeof priceRaw !== 'number') continue;

                const fxRate = await getFxRateForDate(date);
                const priceBrl = (priceRaw * fxRate) + 0.30;

                if (DRY_RUN) {
                    if (stats.pricesInserted < 20) { // Only log first 20 prices in dry run
                        console.log(`[DRY] ${variant.name} (${variant.set_code}) [${finish}] | ${date} | buy: $${priceRaw} -> R$${priceBrl.toFixed(2)}`);
                    }
                    stats.pricesInserted++;
                    continue;
                }

                await supabase.from('price_history').upsert({
                    card_id: variant.id,
                    source: 'CardKingdom',
                    price_type: 'buy',
                    price_raw: priceRaw,
                    currency: 'USD',
                    fx_rate_to_brl: fxRate,
                    price_brl: priceBrl,
                    scraped_at: date
                }, { onConflict: 'card_id,source,scraped_at' });

                stats.pricesInserted++;

                await supabase.from('cards').update({
                    ck_buy_usd: priceRaw,
                    ck_buy_brl: priceBrl,
                    ck_last_update: date
                }).eq('id', variant.id);
            }

            // Process retail prices
            const retailPrices = retailData[finish] || {};
            for (const [date, priceRaw] of Object.entries(retailPrices)) {
                if (typeof priceRaw !== 'number') continue;

                const fxRate = await getFxRateForDate(date);
                const priceBrl = (priceRaw * fxRate) + 0.30;

                if (DRY_RUN) {
                    if (stats.pricesInserted < 20) {
                        console.log(`[DRY] ${variant.name} (${variant.set_code}) [${finish}] | ${date} | retail: $${priceRaw} -> R$${priceBrl.toFixed(2)}`);
                    }
                    stats.pricesInserted++;
                    continue;
                }

                await supabase.from('price_history').upsert({
                    card_id: variant.id,
                    source: 'CardKingdom',
                    price_type: 'sell',
                    price_raw: priceRaw,
                    currency: 'USD',
                    fx_rate_to_brl: fxRate,
                    price_brl: priceBrl,
                    scraped_at: date
                }, { onConflict: 'card_id,source,scraped_at' });

                stats.pricesInserted++;

                await supabase.from('cards').update({
                    ck_retail_usd: priceRaw,
                    ck_retail_brl: priceBrl,
                    ck_last_update: date
                }).eq('id', variant.id);
            }

            if (Object.keys(buyPrices).length > 0 || Object.keys(retailPrices).length > 0) {
                stats.cardsUpdated++;
            }
        }

    } catch (error) {
        console.error(`Error processing UUID ${compactUuid}:`, error);
    }
}

async function main() {
    console.log(`Starting price import from file... (Dry Run: ${DRY_RUN})`);
    console.log(`File: ${PRICES_FILE}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    if (MAX_CARDS) console.log(`TEST MODE: Limited to ${MAX_CARDS} cards`);

    const startTime = Date.now();
    let batch: Array<[string, any]> = [];

    const stream = createReadStream(PRICES_FILE, { encoding: 'utf-8' });
    const parser = JSONStream.parse(['data', { emitKey: true }]);

    return new Promise<void>((resolve, reject) => {
        parser.on('data', async (entry: any) => {
            const uuid = entry.key;
            const priceData = entry.value;

            if (MAX_CARDS && stats.cardsProcessed >= MAX_CARDS) {
                parser.end();
                stream.destroy();
                resolve();
                return;
            }

            batch.push([uuid, priceData]);

            if (batch.length >= BATCH_SIZE) {
                parser.pause();

                console.log(`Processing batch of ${batch.length} cards... (Total: ${stats.cardsProcessed})`);

                for (const [uuid, data] of batch) {
                    await processCardPrices(uuid, data);
                    stats.cardsProcessed++;
                }

                batch = [];

                if (stats.cardsProcessed % (BATCH_SIZE * 10) === 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = stats.cardsProcessed / elapsed;
                    console.log(`\n--- Progress ---`);
                    console.log(`Cards: ${stats.cardsProcessed} | Prices: ${stats.pricesInserted} | Rate: ${rate.toFixed(1)}/s`);
                    console.log(`Unmatched: ${stats.unmatchedCards} | No Price: ${stats.skippedNoPrice}\n`);
                }

                parser.resume();
            }
        });

        parser.on('end', async () => {
            if (batch.length > 0) {
                console.log(`Processing final batch of ${batch.length} cards...`);
                for (const [uuid, data] of batch) {
                    await processCardPrices(uuid, data);
                    stats.cardsProcessed++;
                }
            }

            const totalTime = (Date.now() - startTime) / 1000;

            console.log('\n=== Import Complete ===');
            console.log(`Time: ${totalTime.toFixed(1)}s`);
            console.log(`Cards processed: ${stats.cardsProcessed}`);
            console.log(`Prices inserted: ${stats.pricesInserted}`);
            console.log(`Cards updated: ${stats.cardsUpdated}`);
            console.log(`Unmatched cards: ${stats.unmatchedCards}`);
            console.log(`Skipped (no price): ${stats.skippedNoPrice}`);
            console.log(`FX rates fetched: ${stats.fxRatesFetched}`);

            resolve();
        });

        parser.on('error', reject);

        stream.pipe(parser);
    });
}

main().catch(console.error);
