import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
async function fix() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    try {
        console.log("Fixing enum and user roles...");
        await pool.query(`UPDATE "User" SET role = 'USER' WHERE role::text = 'ADMIN'`);
        console.log("✅ Converted existing ADMIN users to USER");
    }
    catch (e) {
        console.log("Note:", e.message);
    }
    finally {
        await pool.end();
    }
}
fix();
