const multer = require("multer");
const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const resumeFilesController = require("../controllers/resume-files.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf" || !/\.pdf$/i.test(file.originalname || "")) {
      const err = new Error("Apenas arquivos PDF sao aceitos");
      err.statusCode = 400;
      return callback(err);
    }
    return callback(null, true);
  },
});

router.use(authMiddleware);

router.get("/", resumeFilesController.list);
router.post("/", upload.single("resume"), resumeFilesController.upload);
router.get("/:id/view", resumeFilesController.view);
router.get("/:id/download", resumeFilesController.download);
router.delete("/:id", resumeFilesController.remove);

module.exports = router;
