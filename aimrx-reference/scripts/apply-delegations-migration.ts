import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "fs";

async function main() {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DATABASE_URL not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const ddl = readFileSync("/tmp/delegations_migration.sql", "utf8");

  // Split on semicolons but be careful with $$ blocks. Use simple_protocol unsafe.
  console.log("Applying delegations migration…");
  await sql.unsafe(ddl);
  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
