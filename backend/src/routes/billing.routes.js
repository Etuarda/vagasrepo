const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const billingController = require("../controllers/billing.controller");

router.use(authMiddleware);
router.get("/me", billingController.me);

module.exports = router;
