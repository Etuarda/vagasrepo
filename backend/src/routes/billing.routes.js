const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const { rateLimit } = require("../middlewares/security");
const billingController = require("../controllers/billing.controller");

const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "webhook" });

router.post("/webhooks/asaas", webhookLimiter, billingController.asaasWebhook);
router.use(authMiddleware);
router.get("/me", billingController.me);
router.put("/customer", billingController.saveCustomer);
router.post("/checkout", billingController.checkout);
router.post("/refund", billingController.refund);
router.post("/cancel", billingController.cancel);

module.exports = router;
