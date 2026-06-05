const router = require("express").Router();
const { z } = require("zod");
const { authMiddleware } = require("../middlewares/auth");
const { prisma } = require("../lib/prisma");
const emailService = require("../services/email.service");

const supportSchema = z.object({
  subject: z.string().trim().min(3, "Assunto deve ter pelo menos 3 caracteres").max(100),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
});

router.use(authMiddleware);

router.post("/", async (req, res, next) => {
  try {
    const { subject, message } = supportSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { name: true, email: true },
    });
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });

    await emailService.sendSupportEmail({
      userName: user.name,
      userEmail: user.email,
      subject,
      message,
    });

    console.log(JSON.stringify({ event: "support_message_sent", userId: req.userId, subject }));
    return res.json({ sent: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
