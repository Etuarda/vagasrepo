const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const jobsController = require("../controllers/jobs.controller");

router.use(authMiddleware);

router.get("/", jobsController.list);
router.post("/", jobsController.create);
router.put("/:id", jobsController.update);
router.delete("/:id", jobsController.remove);

module.exports = router;
