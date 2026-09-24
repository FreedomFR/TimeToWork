import { PrismaClient } from "@prisma/client";

// Deletes throwaway accounts created by the Playwright E2E suite (see
// e2e/tests/helpers.ts's uniqueUser(), which always emails like
// "e2e_<timestamp>_<n>@example.com"). Cascades to their projects, clients,
// tags and time entries via the schema's onDelete: Cascade.
async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: "e2e_", endsWith: "@example.com" } },
      select: { id: true, email: true, name: true },
    });

    if (users.length === 0) {
      console.log("No E2E test accounts found.");
      return;
    }

    console.log(`Deleting ${users.length} E2E test account(s):`);
    for (const u of users) console.log(`  - ${u.name} <${u.email}>`);

    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
