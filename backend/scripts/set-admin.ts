import { PrismaClient } from "@prisma/client";

/**
 * Gives (or with --revoke, takes away) the admin role of the account with the given email.
 * This is how the FIRST admin is created — after that, admins manage roles from the app.
 *
 *   npx tsx scripts/set-admin.ts someone@example.com
 *   npx tsx scripts/set-admin.ts someone@example.com --revoke
 */
async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || (flag && flag !== "--revoke")) {
    console.error("Usage: tsx scripts/set-admin.ts <email> [--revoke]");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No account with the email ${email}.`);
      process.exit(1);
    }

    const role = flag === "--revoke" ? "USER" : "ADMIN";
    if (role === "USER") {
      const others = await prisma.user.count({ where: { role: "ADMIN", id: { not: user.id } } });
      if (user.role === "ADMIN" && others === 0) {
        console.error("This is the last admin: promote someone else first.");
        process.exit(1);
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { role } });
    console.log(`${user.name} <${user.email}> is now ${role}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
