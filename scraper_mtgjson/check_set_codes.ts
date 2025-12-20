import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking set_code casing in all_cards...");
    const { data } = await supabase
        .from('all_cards')
        .select('set_code')
        .limit(20);

    if (data) {
        console.log('Sample set_codes:', data.map(d => d.set_code));
    }
}

main();
