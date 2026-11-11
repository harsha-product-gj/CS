import pg from "pg";

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("YOUR-")) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  return client;
}
