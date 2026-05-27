const { jobSchema, jobListQuerySchema, idParamSchema } = require("../schemas/job.schema");
const jobsService = require("../services/jobs.service");

async function list(req, res, next) {
  try {
    const { q, status, period, dateFrom, dateTo, limit, cursor } = jobListQuerySchema.parse(req.query);

    // Regras de precedência:
    // - Se period for currentMonth/last7/last30, ignora dateFrom/dateTo
    // - Se period for ausente, usa dateFrom/dateTo se existirem
    const filters = {
      q,
      status,
      period,
      dateFrom: period ? undefined : dateFrom,
      dateTo: period ? undefined : dateTo,
      limit,
      cursor,
    };

    const jobs = await jobsService.listJobs(req.userId, filters);
    return res.json(jobs);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const payload = jobSchema.parse(req.body);
    const job = await jobsService.createJob(req.userId, payload);
    return res.status(201).json(job);
  } catch (err) {
    return next(err);
  }
}

async function get(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const job = await jobsService.getJob(req.userId, id);
    return res.json(job);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = jobSchema.parse(req.body);
    const out = await jobsService.updateJob(req.userId, id, payload);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const out = await jobsService.deleteJob(req.userId, id);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, get, create, update, remove };
