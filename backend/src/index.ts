/** Server entry point. `app.ts` holds the Express app so tests can import it without listening. */
import "dotenv/config";
import { app } from "./app";
import { assertSafeJwtSecret } from "./middleware/auth";

assertSafeJwtSecret();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`TimeToWork API listening on port ${PORT}`);
});
