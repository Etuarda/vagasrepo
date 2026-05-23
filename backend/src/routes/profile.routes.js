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
router.post("/profile/courses", profileController.addCourse);
router.delete("/profile/courses/:id", profileController.deleteCourse);
router.post("/profile/certifications", profileController.addCertification);
router.delete("/profile/certifications/:id", profileController.deleteCertification);
router.post("/profile/languages", profileController.addLanguage);
router.delete("/profile/languages/:id", profileController.deleteLanguage);
router.post("/match", profileController.match);
router.get("/optimized-resumes", profileController.listOptimized);
router.get("/optimized-resumes/:id/download", profileController.downloadOptimized);
router.delete("/optimized-resumes/:id", profileController.deleteOptimized);

module.exports = router;
