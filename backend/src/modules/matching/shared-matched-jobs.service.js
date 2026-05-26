const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../../services/subscription.service");
const { FEATURES } = require("../../constants/subscription-plans");

const PERIOD_DAYS = Object.freeze({
  day: 1,
  week: 7,
  month: 30,
});

function periodCutoff(period, now = new Date()) {
  return new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
}

function publicKey(job) {
  return [job.jobTitle, job.company, job.jobUrl]
    .map((value) => String(value || "").trim().toLocaleLowerCase())
    .join("|");
}

function dedupeLatestJobs(rows) {
  const jobs = new Map();
  rows
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((job) => {
      const key = publicKey(job);
      if (!jobs.has(key)) jobs.set(key, job);
    });
  return [...jobs.values()].slice(0, 200);
}

async function createSharedMatchedJob(db, data) {
  return db.sharedMatchedJob.create({
    data: {
      jobTitle: data.jobTitle,
      company: data.company,
      jobUrl: data.linkVaga,
    },
  });
}

async function listSharedMatchedJobs(userId, period = "month") {
  await subscriptionService.assertFeatureAccess(userId, FEATURES.SHARED_MATCHED_JOBS);
  const cutoff = periodCutoff(period);
  const jobs = await cache.remember("shared-jobs-board", "global", period, async () => {
    const [matchedJobs, trackedJobs] = await Promise.all([
      prisma.sharedMatchedJob.findMany({
        where: { createdAt: { gte: cutoff } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          jobTitle: true,
          company: true,
          jobUrl: true,
          createdAt: true,
        },
      }),
      prisma.job.findMany({
        where: { data: { gte: cutoff } },
        orderBy: { data: "desc" },
        take: 200,
        select: {
          id: true,
          titulo: true,
          empresa: true,
          linkVaga: true,
          data: true,
        },
      }),
    ]);

    return dedupeLatestJobs([
      ...matchedJobs.map((job) => ({ ...job, origin: "matching" })),
      ...trackedJobs.map((job) => ({
        id: `tracked:${job.id}`,
        jobTitle: job.titulo,
        company: job.empresa,
        jobUrl: job.linkVaga,
        createdAt: job.data,
        origin: "tracking",
      })),
    ]);
  });
  return jobs.filter((job) => new Date(job.createdAt) >= cutoff);
}

module.exports = { PERIOD_DAYS, periodCutoff, dedupeLatestJobs, createSharedMatchedJob, listSharedMatchedJobs };
