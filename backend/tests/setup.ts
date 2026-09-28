import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { flushLogs } from "../src/lib/logger";

beforeAll(() => {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL ("${process.env.DATABASE_URL}") does not look like a test database`
    );
  }
});

// Never actually send email during tests — routes that trigger it are
// exercised, but delivery itself is mocked and asserted on separately.
vi.mock("../src/lib/mailer", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendEmailChangedNotice: vi.fn(async () => {}),
}));

afterEach(async () => {
  // Journal writes run in the background: let them land before the accounts they refer to are deleted
  await flushLogs();
  await prisma.timeEntryTag.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
