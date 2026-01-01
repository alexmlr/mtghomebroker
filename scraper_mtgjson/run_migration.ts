
import { Client } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('Missing DATABASE_URL or SUPABASE_DB_URL');
    process.exit(1);
}

async function runMigration() {
    console.log('Connecting to DB...');
    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        console.log('Connected.');

        const sqlPath = path.resolve(__dirname, 'add_vendor_columns.sql');
        console.log(`Reading SQL from ${sqlPath}...`);

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('SQL Executed Successfully.');

    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await client.end();
    }
}

runMigration();
