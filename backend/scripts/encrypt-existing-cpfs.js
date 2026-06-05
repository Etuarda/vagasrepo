// npx node scripts/encrypt-existing-cpfs.js
// Requer CPF_ENCRYPTION_KEY definida no .env
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { encrypt, isEncrypted } = require("../src/lib/crypto");

const prisma = new PrismaClient();

async function main() {
  if (!process.env.CPF_ENCRYPTION_KEY) {
    console.error("CPF_ENCRYPTION_KEY nao definida. Abortando.");
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    select: { id: true, cpfCnpj: true },
    where: { cpfCnpj: { not: "" } },
  });

  let encrypted = 0;
  let skipped = 0;

  for (const user of users) {
    if (isEncrypted(user.cpfCnpj)) {
      skipped++;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { cpfCnpj: encrypt(user.cpfCnpj) },
    });
    encrypted++;
  }

  console.log(`Concluido: ${encrypted} criptografados, ${skipped} ja criptografados.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
