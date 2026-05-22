const multer = require("multer");
const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const resumeFilesController = require("../controllers/resume-files.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get("/", resumeFilesController.list);
router.post("/", upload.single("resume"), resumeFilesController.upload);
router.get("/:id/download", resumeFilesController.download);
router.delete("/:id", resumeFilesController.remove);

module.exports = router;
