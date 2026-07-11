const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

const WEAK = ["change-me", "admin1234", "password", "12345678", "admin"];

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@funwithu.in";
  let password = process.env.ADMIN_PASSWORD;
  const prod = process.env.NODE_ENV === "production";

  if (!password || WEAK.includes(password) || password.length < 12) {
    if (prod) {
      console.error(
        "FATAL: set ADMIN_PASSWORD in .env to a strong password (12+ chars, not a default) before seeding in production."
      );
      process.exit(1);
    }
    // dev convenience: generate a random one and print it once
    password = crypto.randomBytes(12).toString("base64url");
    console.log(`Generated dev admin password: ${password}`);
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", password: hash },
    create: { email, password: hash, name: "Admin", role: "ADMIN", coins: 0 },
  });
  console.log(`Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
