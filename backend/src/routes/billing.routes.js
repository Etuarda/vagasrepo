const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const billingController = require("../controllers/billing.controller");

router.use(authMiddleware);
router.get("/me", billingController.me);
router.patch("/me", billingController.update);

module.exports = router;
