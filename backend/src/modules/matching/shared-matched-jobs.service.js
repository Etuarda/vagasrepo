const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../../services/subscription.service");
const profileService = require("../../services/profile.service");
const { FEATURES } = require("../../constants/subscription-plans");
const { evaluateJobMatch } = require("./job-match-evaluator.service");

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

function calculateProfileMatch(job, profile) {
  return evaluateJobMatch({
    profile,
    jobTitle: job.jobTitle,
    company: job.company,
    jobDescription: job.jobDescription || "",
    confirmedSeniority: job.confirmedSeniority && job.confirmedSeniority !== "unknown" ? job.confirmedSeniority : undefined,
  });
}

function summarizeMatch(match) {
  if (!match) return null;
  return {
    overallScore: match.overallScore,
    score: match.overallScore,
    matchedSkills: (match.matchedSkills || []).slice(0, 8),
    missingSkills: (match.missingSkills || []).slice(0, 8),
    seniorityMatch: match.seniorityMatch,
    seniorityPenalty: match.seniorityPenalty,
    riskFlags: match.riskFlags || [],
  };
}

async function calculateSharedJobMatches(job, profiles) {
  const globalProfile = profiles.find((profile) => profile.isGlobal) || profiles[0];
  const globalMatch = globalProfile ? calculateProfileMatch(job, globalProfile) : null;
  const subprofileMatches = profiles
    .filter((profile) => !profile.isGlobal)
    .map((profile) => ({ profile, match: calculateProfileMatch(job, profile) }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore);
  const best = subprofileMatches[0] || null;

  return {
    globalMatch: summarizeMatch(globalMatch),
    bestSubprofileMatch: best ? {
      profileId: best.profile.id,
      profileName: best.profile.profileName,
      ...summarizeMatch(best.match),
    } : null,
    profileMatch: summarizeMatch(best?.match || globalMatch),
  };
}

async function createSharedMatchedJob(db, data) {
  return db.sharedMatchedJob.create({
    data: {
      jobTitle: data.jobTitle,
      company: data.company,
      jobUrl: data.linkVaga,
      jobDescription: data.jobDescription || "",
      confirmedSeniority: data.confirmedSeniority || "unknown",
      inferredSeniority: data.inferredSeniority || "unknown",
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
          jobDescription: true,
          confirmedSeniority: true,
          inferredSeniority: true,
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
          jobDescription: true,
          jobAnalysis: { select: { confirmedSeniority: true, inferredSeniority: true } },
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
        jobDescription: job.jobDescription,
        confirmedSeniority: job.jobAnalysis?.confirmedSeniority || "unknown",
        inferredSeniority: job.jobAnalysis?.inferredSeniority || "unknown",
        createdAt: job.data,
        origin: "tracking",
      })),
    ]);
  });
  const visibleJobs = jobs.filter((job) => new Date(job.createdAt) >= cutoff);
  const listedProfiles = await profileService.listProfiles(userId);
  const profiles = await Promise.all(listedProfiles.map((item) => profileService.getProfile(userId, item.id)));
  return Promise.all(visibleJobs.map(async (job) => {
      const { jobDescription, confirmedSeniority, inferredSeniority, ...publicJob } = job;
      const matches = await calculateSharedJobMatches(job, profiles);
      return {
        ...publicJob,
        confirmedSeniority,
        inferredSeniority,
        ...matches,
      };
    }));
}

module.exports = { PERIOD_DAYS, periodCutoff, dedupeLatestJobs, createSharedMatchedJob, listSharedMatchedJobs };
