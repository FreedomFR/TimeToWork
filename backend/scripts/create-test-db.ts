import { PrismaClient } from "@prisma/client";

async function main() {
  const testDbUrl = process.env.DATABASE_URL;
  if (!testDbUrl) throw new Error("DATABASE_URL is not set");

  const url = new URL(testDbUrl);
  const dbName = url.pathname.slice(1);
  if (!dbName.includes("test")) {
    throw new Error(`Refusing to run: "${dbName}" does not look like a test database`);
  }

  const adminUrl = new URL(testDbUrl);
  adminUrl.pathname = "/postgres";

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}"`);
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log(`Database "${dbName}" already exists, reusing it`);
    } else {
      throw err;
    }
  } finally {
    await admin.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
