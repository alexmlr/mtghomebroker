
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('--- DEBUG START ---');

    // 1. Get a sample card from 'all_cards'
    const { data: card, error: cardError } = await supabase
        .from('all_cards')
        .select('*')
        .limit(1)
        .single();

    if (cardError || !card) {
        console.error('Error fetching sample card:', cardError);
        return;
    }

    console.log(`Sample Card: ${card.name} (ID: ${card.id}, UUID: ${card.mtgjson_uuid})`);

    // 2. Fetch MTGJSON data for this UUID (Mocking the fetch by querying specific UUID from API if possible, or just checking if we can insert ANY history for it)
    // We'll simulate receiving data for this card.
    const mockPrice = 10.50;
    const now = new Date().toISOString();

    // 3. Try Inserting into Price History
    // Using mapping logic: converting UUID -> ID (which we already have as card.id)

    const historyEntry = {
        card_id: card.id,
        source: 'CardKingdom',
        price_type: 'buy', // Buylist
        price_raw: mockPrice,
        currency: 'USD',
        fx_rate_to_brl: 6.0,
        price_brl: (mockPrice * 6.0) + 0.30,
        scraped_at: now,
        created_at: now // Explicitly helping Supabase if needed
    };

    console.log('Attempting to insert history entry:', historyEntry);

    const { data: insertData, error: insertError } = await supabase
        .from('price_history')
        .insert(historyEntry)
        .select();

    if (insertError) {
        console.error('INSERT FAILED:', insertError);
        // Check triggers or constraints?
    } else {
        console.log('INSERT SUCCESS:', insertData);
        // Check if it's visible
        const { count } = await supabase.from('price_history').select('*', { count: 'exact', head: true });
        console.log('Total Price History Count after insert:', count);
    }
}

debug();
