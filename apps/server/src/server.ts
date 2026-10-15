import { fileURLToPath } from "node:url";
import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const databasePath =
  process.env.DATABASE_PATH ??
  fileURLToPath(new URL("../data/session-results.sqlite", import.meta.url));

const app = buildApp({ databasePath });

try {
  await app.listen({ port });
  console.log(`API listening on http://localhost:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
