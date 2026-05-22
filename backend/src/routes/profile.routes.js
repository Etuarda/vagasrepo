const router = require("express").Router();
const { authMiddleware } = require("../middlewares/auth");
const profileController = require("../controllers/profile.controller");

router.use(authMiddleware);

router.get("/profiles", profileController.listProfiles);
router.post("/profiles", profileController.createProfile);
router.get("/profile", profileController.getProfile);
router.put("/profile", profileController.updateProfile);
router.put("/profile/skills", profileController.updateSkills);
router.post("/profile/projects", profileController.addProject);
router.delete("/profile/projects/:id", profileController.deleteProject);
router.post("/profile/experiences", profileController.addExperience);
router.delete("/profile/experiences/:id", profileController.deleteExperience);
router.post("/match", profileController.match);
router.get("/optimized-resumes", profileController.listOptimized);
router.get("/optimized-resumes/:id/download", profileController.downloadOptimized);
router.delete("/optimized-resumes/:id", profileController.deleteOptimized);

module.exports = router;
