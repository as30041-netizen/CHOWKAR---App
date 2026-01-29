
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Connection string from previous attempts
// Connection string - Try Env first, then fallback to local default
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:54322/postgres";

async function runSql() {
    // Get file from args: node executeSql.js <path>
    const relativePath = process.argv[2];

    if (!relativePath) {
        console.error('Usage: node executeSql.js <path_to_sql_file>');
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sqlPath = path.resolve(relativePath);
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`File not found: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing SQL from ${relativePath}...`);
        await client.query(sql);
        console.log('SQL executed successfully!');
    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await client.end();
    }
}

runSql();
