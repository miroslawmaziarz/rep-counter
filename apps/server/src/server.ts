import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

try {
  await app.listen({ port });
  console.log(`API listening on http://localhost:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
