require("dotenv").config();
const { decrypt, isEncrypted } = require("../src/lib/crypto");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

p.user.findMany({ where: { cpfCnpj: { not: "" } }, select: { id: true, cpfCnpj: true } })
  .then((users) => {
    users.forEach((u) => {
      const raw = decrypt(u.cpfCnpj);
      console.log(`id: ${u.id.slice(0, 8)} | encrypted: ${isEncrypted(u.cpfCnpj)} | decrypted digits: ${raw.length}`);
    });
    console.log(`\nTotal: ${users.length} usuarios com CPF`);
  })
  .finally(() => p.$disconnect());
