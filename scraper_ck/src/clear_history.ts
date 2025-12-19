import { supabase } from './database';

async function clearHistory() {
    console.log('Clearing public.price_history table...');

    // Delete all rows where id is greater than 0 (assuming id is positive integer)
    // This is a safety requirement of supabase-js delete()
    const { error, count } = await supabase
        .from('price_history')
        .delete({ count: 'exact' })
        .gt('id', 0);

    if (error) {
        console.error('Error clearing history:', error);
    } else {
        console.log(`Successfully deleted ${count} rows from price_history.`);
    }
}

clearHistory();
