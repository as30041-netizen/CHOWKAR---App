
const pg = require('pg');

async function inspect() {
    const connectionString = "postgresql://postgres:postgres@localhost:54322/postgres";
    const client = new pg.Client({ connectionString });

    try {
        await client.connect();

        // 1. Get all tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        console.log('--- DATABASE TABLES ---');
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log(tables.join(', '));
        console.log('------------------------\n');

        // 2. Get columns for each table
        for (const table of tables) {
            const colsRes = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position
            `, [table]);

            console.log(`Table: ${table}`);
            colsRes.rows.forEach(c => {
                console.log(`  - ${c.column_name}: ${c.data_type} (${c.is_nullable === 'NO' ? 'NOT NULL' : 'pk'}) [Default: ${c.column_default || 'none'}]`);
            });
            console.log('');
        }

    } catch (err) {
        console.error('Inspection failed:', err);
    } finally {
        await client.end();
    }
}

inspect();
