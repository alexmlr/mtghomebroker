
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load env from the root or scraper folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    let logBuffer = "";
    const log = (msg: string) => { console.log(msg); logBuffer += msg + "\n"; };

    log("Checking Sets vs All Cards...");

    // 1. Get 5 sets
    const { data: sets, error: setsError } = await supabase.from('sets').select('*').limit(5);
    if (setsError) {
        log("Error fetching sets: " + JSON.stringify(setsError));
        fs.writeFileSync('debug_output.txt', logBuffer);
        return;
    }
    log("\nSample Sets: " + sets?.map(s => `${s.name} (${s.code})`).join(', '));

    // 2. Get 5 cards
    const { data: cards, error: cardsError } = await supabase.from('all_cards').select('name, set_code, set_name').limit(5);
    if (cardsError) {
        log("Error fetching cards: " + JSON.stringify(cardsError));
        fs.writeFileSync('debug_output.txt', logBuffer);
        return;
    }
    log("\nSample Cards: " + cards?.map(c => `${c.name} [Code: ${c.set_code}]`).join(', '));

    // 3. Check for a specific match
    if (sets && sets.length > 0) {
        const cardSetCode = cards?.[0]?.set_code;
        const testSet = cardSetCode ? sets.find(s => s.code.toLowerCase() === cardSetCode.toLowerCase()) || sets[0] : sets[0];

        log(`\nTesting filtering for set: ${testSet.name} (${testSet.code})`);

        const { count, error: filterError } = await supabase
            .from('all_cards')
            .select('*', { count: 'exact', head: true })
            .eq('set_code', testSet.code);

        if (filterError) log("Filter error: " + JSON.stringify(filterError));
        log(`Found ${count} cards with set_code '${testSet.code}' (Exact Match)`);

        // Try case insensitivity check if 0
        if (count === 0) {
            const { count: countUpper } = await supabase.from('all_cards').select('*', { count: 'exact', head: true }).eq('set_code', testSet.code.toUpperCase());
            log(`Found ${countUpper} cards with set_code '${testSet.code.toUpperCase()}' (Upper)`);

            const { count: countLower } = await supabase.from('all_cards').select('*', { count: 'exact', head: true }).eq('set_code', testSet.code.toLowerCase());
            log(`Found ${countLower} cards with set_code '${testSet.code.toLowerCase()}' (Lower)`);
        }
    }

    // 4. Check View-like Join
    if (cards && cards.length > 0) {
        const code = cards[0].set_code;
        const { data: setMatch } = await supabase.from('sets').select('*').eq('code', code);
        log(`\nManual Join Test: Card set_code '${code}' -> Set found: ${setMatch?.length ? 'YES' : 'NO'}`);
        if (setMatch?.length) log("Matched Set: " + JSON.stringify(setMatch[0]));
        else {
            // Try check insensitive
            const { data: setMatchIns } = await supabase.from('sets').select('*').ilike('code', code);
            log(`Manual Join Test (Insensitive): Card set_code '${code}' -> Set found: ${setMatchIns?.length ? 'YES' : 'NO'}`);
        }
    }

    fs.writeFileSync('debug_output.txt', logBuffer);
}

checkData();
