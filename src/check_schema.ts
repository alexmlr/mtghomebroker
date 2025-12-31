import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Env loading logic
const pathsToCheck = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env')
];

for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        const envConfig = dotenv.parse(fs.readFileSync(p));
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
        break;
    }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
    console.log('Checking all_cards schema...');
    const { data, error } = await supabase.from('all_cards').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
        console.log('Table seems empty or accessible but no data returned.');
    }
}
check();
