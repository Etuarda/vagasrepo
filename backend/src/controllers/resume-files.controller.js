const resumeFilesService = require("../services/resume-files.service");
const { idParamSchema, profileIdSchema } = require("../schemas/profile.schema");

async function upload(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.body);
    const file = await resumeFilesService.uploadResumeFile(req.userId, req.file, profileId || null);
    return res.status(201).json(file);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const { profileId } = profileIdSchema.parse(req.query);
    const files = await resumeFilesService.listResumeFiles(req.userId, profileId || null);
    return res.json(files);
  } catch (err) {
    return next(err);
  }
}

async function download(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const file = await resumeFilesService.getResumeFile(req.userId, id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.sizeBytes);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    return res.send(Buffer.from(file.content));
  } catch (err) {
    return next(err);
  }
}

async function view(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const file = await resumeFilesService.getResumeFile(req.userId, id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.sizeBytes);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    return res.send(Buffer.from(file.content));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const out = await resumeFilesService.deleteResumeFile(req.userId, id);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload, list, view, download, remove };
