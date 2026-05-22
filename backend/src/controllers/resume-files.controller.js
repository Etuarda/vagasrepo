const resumeFilesService = require("../services/resume-files.service");

async function upload(req, res, next) {
  try {
    const file = await resumeFilesService.uploadResumeFile(req.userId, req.file, req.body.profileId || null);
    return res.status(201).json(file);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const files = await resumeFilesService.listResumeFiles(req.userId, req.query.profileId || null);
    return res.json(files);
  } catch (err) {
    return next(err);
  }
}

async function download(req, res, next) {
  try {
    const file = await resumeFilesService.getResumeFile(req.userId, req.params.id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.sizeBytes);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    return res.send(Buffer.from(file.content));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const out = await resumeFilesService.deleteResumeFile(req.userId, req.params.id);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload, list, download, remove };
