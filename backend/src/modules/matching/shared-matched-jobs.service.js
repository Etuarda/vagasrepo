const { prisma } = require("../../lib/prisma");

const PERIOD_DAYS = Object.freeze({
  day: 1,
  week: 7,
  month: 30,
});

function periodCutoff(period, now = new Date()) {
  return new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
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

async function listSharedMatchedJobs(period = "month") {
  return prisma.sharedMatchedJob.findMany({
    where: { createdAt: { gte: periodCutoff(period) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      jobTitle: true,
      company: true,
      jobUrl: true,
      createdAt: true,
    },
  });
}

module.exports = { PERIOD_DAYS, periodCutoff, createSharedMatchedJob, listSharedMatchedJobs };
