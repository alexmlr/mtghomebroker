
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { scrapeCard, scrapeLigaMagic } from './scraper';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBatchScraper() {
    console.log('Starting Batch Scraper...');

    // 1. Get all cards that are being tracked by at least one user
    // We can join user_tracked_cards, or just select distinct card_ids from it.
    // Simpler: Fetch ALL cards from `cards` table that have a link_ck (implying they were added via tracker).
    // Better: Fetch only cards in `user_tracked_cards`.

    // Step 1: Get Unique Card IDs to scrape
    const { data: trackedCards, error: trackedError } = await supabase
        .from('user_tracked_cards')
        .select('card_id');

    if (trackedError) {
        console.error('Error fetching tracked cards:', trackedError);
        return;
    }

    if (!trackedCards || trackedCards.length === 0) {
        console.log('No tracked cards found.');
        return;
    }

    // Deduplicate IDs
    const uniqueCardIds = [...new Set(trackedCards.map(tc => tc.card_id))];
    console.log(`Found ${uniqueCardIds.length} unique cards to scrape.`);

    // Step 2: Fetch details (Links) for these cards
    const { data: cardsToScrape, error: cardsError } = await supabase
        .from('cards')
        .select('id, link_ck, link_lm, is_foil')
        .in('id', uniqueCardIds);

    if (cardsError) {
        console.error('Error fetching card details:', cardsError);
        return;
    }

    // Step 3: Iterate and Scrape
    // We do this sequentially or with limited concurrency to avoid IP blocks.
    // Sequential for safety first version.

    for (const card of cardsToScrape || []) {
        console.log(`----------------------------------------------------------------`);
        console.log(`Processing Card ID: ${card.id}`);

        // CK Scrape
        if (card.link_ck) {
            try {
                // scrapeCard handles upsert and price history internally
                await scrapeCard(card.link_ck);
                console.log(`CK Scrape Success: Card ${card.id}`);
            } catch (e) {
                console.error(`CK Scrape Failed for ${card.id}:`, e);
            }
        } else {
            console.warn(`Card ${card.id} has no CK Link. Skipping CK.`);
        }

        // Wait a bit between requests
        await new Promise(r => setTimeout(r, 2000));

        // LM Scrape
        if (card.link_lm) {
            try {
                // scrapeLigaMagic handles update and price history internally
                await scrapeLigaMagic(card.link_lm, card.id, card.is_foil);
                console.log(`LM Scrape Success: Card ${card.id}`);
            } catch (e) {
                console.error(`LM Scrape Failed for ${card.id}:`, e);
            }
        }

        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Batch Scraper Completed.');
}

runBatchScraper();
