
import { supabase } from './database';

async function check() {
    try {
        console.log("Checking DB counts...");
        // Check all_cards count
        const { count: allCards } = await supabase.from('all_cards').select('*', { count: 'exact', head: true });
        // Check all_cards with links? (If column exists)
        // We'll wrap in try/catch in case column doesn't exist
        console.log(`Table 'all_cards': ${allCards}`);

        try {
            const { count: allCardsCk } = await supabase.from('all_cards').select('*', { count: 'exact', head: true }).not('link_ck', 'is', null);
            console.log(`Table 'all_cards' with CK Link: ${allCardsCk}`);
        } catch (e) {
            console.log("Could not check link_ck on all_cards (maybe column missing)");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

check();
