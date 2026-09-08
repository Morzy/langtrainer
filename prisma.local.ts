import { Client } from "pg";
import { startPrismaDevServer } from "@prisma/dev";
async function startLocalPrisma(name: string) {
  return await startPrismaDevServer({
    name, // required, use a unique name if running tests in parallel
    port: 51213, // optional, defaults to 51213
    databasePort: 51214, // optional, defaults to 51214
    shadowDatabasePort: 51215, // optional, defaults to 51215
    persistenceMode: "stateless", // optional, defaults to 'stateless'. Use 'stateful' to persist data between runs
  });
}
// Usage in tests
const server = await startLocalPrisma(`lantrainer`);
try {
  const client = new Client({
    connectionString: server.database.connectionString,
  });
  await client.connect();
  const res = await client.query(`SELECT 1 as "abba"`);
  console.log(res.rows);
  client.end();
} finally {
  await server.close!();
}