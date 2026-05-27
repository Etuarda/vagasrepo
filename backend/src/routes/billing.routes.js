const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const billingController = require("../controllers/billing.controller");

router.post("/webhooks/asaas", billingController.asaasWebhook);
router.use(authMiddleware);
router.get("/me", billingController.me);
router.put("/customer", billingController.saveCustomer);
router.post("/checkout", billingController.checkout);

module.exports = router;
