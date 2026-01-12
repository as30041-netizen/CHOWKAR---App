
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Connection string from previous attempts
const connectionString = "postgresql://postgres:postgres@localhost:54322/postgres";

async function runSql() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sqlPath = path.resolve('sql/FIX_DATA_INTEGRITY_FEEDS.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('SQL executed successfully!');
    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await client.end();
    }
}

runSql();
