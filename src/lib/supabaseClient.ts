import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
    console.error('Invalid or missing Supabase environment variables. Check your .env file.');
}

// Create client only if URL is valid to avoid crash, otherwise create a dummy client that logs errors
export const supabase = isValidUrl(supabaseUrl) && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder');

