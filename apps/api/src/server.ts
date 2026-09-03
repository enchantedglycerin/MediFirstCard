import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initDb } from "./db/index.js";

const db = await initDb();
const app = createApp({ db });
app.listen(env.PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`MediFirstCard API listening on :${env.PORT} (${env.NODE_ENV})`);
});
