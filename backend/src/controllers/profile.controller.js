const {
  profileSchema,
  createProfileSchema,
  skillsSchema,
  projectSchema,
  experienceSchema,
  courseSchema,
  certificationSchema,
  languageSchema,
  educationSchema,
  subprofileAllocationSchema,
  matchSchema,
  sharedMatchedJobsQuerySchema,
  jobAnalysisUpdateSchema,
  profileIdSchema,
  idParamSchema,
} = require("../schemas/profile.schema");
const { createApplicationFromAnalysisSchema } = require("../schemas/job.schema");
const profileService = require("../services/profile.service");
const matchingService = require("../services/matching.service");
const sharedMatchedJobsService = require("../modules/matching/shared-matched-jobs.service");
const applicationTrackingService = require("../modules/application-tracking/application-tracking.service");

async function listProfiles(req, res, next) {
  try {
    const profiles = await profileService.listProfiles(req.userId);
    return res.json(profiles);
  } catch (err) {
    return next(err);
  }
}

async function createProfile(req, res, next) {
  try {
    const payload = createProfileSchema.parse(req.body);
    const profile = await profileService.createProfile(req.userId, payload);
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
}

async function deleteProfile(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await profileService.deleteProfile(req.userId, id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const profile = await profileService.getProfile(req.userId, profileId);
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const payload = profileSchema.parse(req.body);
    const { profileId } = profileIdSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.userId, profileId, payload);
    return res.json({ user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateSkills(req, res, next) {
  try {
    const payload = skillsSchema.parse(req.body);
    const profile = await profileService.updateSkills(req.userId, payload.profileId, payload.skills);
    return res.json({ skills: profile.skills, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateSubprofileAllocation(req, res, next) {
  try {
    const payload = subprofileAllocationSchema.parse(req.body);
    const profile = await profileService.updateSubprofileAllocation(req.userId, payload);
    return res.json({ user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addProject(req, res, next) {
  try {
    const payload = projectSchema.parse(req.body);
    const profile = await profileService.addProject(req.userId, payload.profileId, payload);
    return res.status(201).json({ projects: profile.projects, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = projectSchema.parse(req.body);
    const profile = await profileService.updateProject(req.userId, payload.profileId, id, payload);
    return res.json({ projects: profile.projects, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteProject(req.userId, profileId, id);
    return res.json({ projects: profile.projects, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addExperience(req, res, next) {
  try {
    const payload = experienceSchema.parse(req.body);
    const profile = await profileService.addExperience(req.userId, payload.profileId, payload);
    return res.status(201).json({ experiences: profile.experiences, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateExperience(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = experienceSchema.parse(req.body);
    const profile = await profileService.updateExperience(req.userId, payload.profileId, id, payload);
    return res.json({ experiences: profile.experiences, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function deleteExperience(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteExperience(req.userId, profileId, id);
    return res.json({ experiences: profile.experiences, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addCourse(req, res, next) {
  try {
    const payload = courseSchema.parse(req.body);
    const profile = await profileService.addCourse(req.userId, payload.profileId, payload);
    return res.status(201).json({ courses: profile.courses, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateCourse(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = courseSchema.parse(req.body);
    const profile = await profileService.updateCourse(req.userId, payload.profileId, id, payload);
    return res.json({ courses: profile.courses, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteCourse(req.userId, profileId, id);
    return res.json({ courses: profile.courses, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addCertification(req, res, next) {
  try {
    const payload = certificationSchema.parse(req.body);
    const profile = await profileService.addCertification(req.userId, payload.profileId, payload);
    return res.status(201).json({ certifications: profile.certifications, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateCertification(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = certificationSchema.parse(req.body);
    const profile = await profileService.updateCertification(req.userId, payload.profileId, id, payload);
    return res.json({ certifications: profile.certifications, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function deleteCertification(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteCertification(req.userId, profileId, id);
    return res.json({ certifications: profile.certifications, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addLanguage(req, res, next) {
  try {
    const payload = languageSchema.parse(req.body);
    const profile = await profileService.addLanguage(req.userId, payload.profileId, payload);
    return res.status(201).json({ languages: profile.languages, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateLanguage(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = languageSchema.parse(req.body);
    const profile = await profileService.updateLanguage(req.userId, payload.profileId, id, payload);
    return res.json({ languages: profile.languages, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function deleteLanguage(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteLanguage(req.userId, profileId, id);
    return res.json({ languages: profile.languages, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function addEducation(req, res, next) {
  try {
    const payload = educationSchema.parse(req.body);
    const profile = await profileService.addEducation(req.userId, payload.profileId, payload);
    return res.status(201).json({ educations: profile.educations, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function updateEducation(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = educationSchema.parse(req.body);
    const profile = await profileService.updateEducation(req.userId, payload.profileId, id, payload);
    return res.json({ educations: profile.educations, user: profile });
  } catch (err) {
    return next(err);
  }
}
async function deleteEducation(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const { id } = idParamSchema.parse(req.params);
    const profile = await profileService.deleteEducation(req.userId, profileId, id);
    return res.json({ educations: profile.educations, user: profile });
  } catch (err) {
    return next(err);
  }
}

async function match(req, res, next) {
  try {
    const payload = matchSchema.parse(req.body);
    const result = await matchingService.executeMatch(req.userId, payload.jobDescription, payload.profileId, payload);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function listSharedMatchedJobs(req, res, next) {
  try {
    const { period } = sharedMatchedJobsQuerySchema.parse(req.query);
    const jobs = await sharedMatchedJobsService.listSharedMatchedJobs(req.userId, period);
    return res.json(jobs);
  } catch (err) {
    return next(err);
  }
}

async function updateAnalysis(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = jobAnalysisUpdateSchema.parse(req.body);
    const analysis = await matchingService.updateAnalysis(req.userId, id, payload);
    const message = analysis.status === "applied" || analysis.status === "Aplicada"
      ? `Curriculo marcado como aplicado para a vaga ${analysis.jobTitle}${analysis.company ? ` na empresa ${analysis.company}` : ""}.`
      : "Analise atualizada.";
    return res.json({ analysis, message });
  } catch (err) {
    return next(err);
  }
}

async function getAnalysis(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const analysis = await matchingService.getAnalysis(req.userId, id);
    return res.json(analysis);
  } catch (err) {
    return next(err);
  }
}

async function createApplication(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = createApplicationFromAnalysisSchema.parse(req.body);
    const result = await applicationTrackingService.createFromAnalysis(req.userId, id, payload);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function listOptimized(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const rows = await matchingService.listHistory(req.userId, profileId);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function deleteOptimized(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const out = await matchingService.deleteHistory(req.userId, id);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

async function downloadOptimized(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const file = await matchingService.getGeneratedPdf(req.userId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", file.content.length);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    return res.send(file.content);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getProfile,
  listProfiles,
  createProfile,
  deleteProfile,
  updateProfile,
  updateSkills,
  updateSubprofileAllocation,
  addProject,
  updateProject,
  deleteProject,
  addExperience,
  updateExperience,
  deleteExperience,
  addCourse,
  updateCourse,
  deleteCourse,
  addCertification,
  updateCertification,
  deleteCertification,
  addLanguage,
  updateLanguage,
  deleteLanguage,
  addEducation,
  updateEducation,
  deleteEducation,
  match,
  listSharedMatchedJobs,
  listOptimized,
  deleteOptimized,
  downloadOptimized,
  updateAnalysis,
  getAnalysis,
  createApplication,
};
