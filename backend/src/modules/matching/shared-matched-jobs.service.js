const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../../services/subscription.service");
const profileService = require("../../services/profile.service");
const { FEATURES } = require("../../constants/subscription-plans");
const { classifyJob, normalizeTerm } = require("./keyword-normalizer");
const { collectLearnedSkillItems } = require("../resume/resume-compiler.service");

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

const SENIORITY_ORDER = Object.freeze({
  estagiario: 0,
  junior: 1,
  pleno: 2,
  senior: 3,
  lead: 4,
  specialist: 4,
});

const SENIORITY_ALIASES = Object.freeze({
  estagiario: ["estagio", "estagiario", "estagiaria", "intern", "trainee"],
  junior: ["junior", "jr", "junior"],
  pleno: ["pleno", "mid", "middle"],
  senior: ["senior", "senior", "sr"],
  lead: ["lead", "lider", "tech lead", "principal", "staff"],
  specialist: ["especialista", "specialist"],
});

function inferSeniority(text) {
  const normalized = ` ${normalizeTerm(String(text || "").replace(/[\/|,.;:()[\]{}]/g, " "))} `;
  const matches = Object.entries(SENIORITY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(` ${normalizeTerm(alias)} `)))
    .map(([level]) => level);
  return matches.sort((a, b) => SENIORITY_ORDER[b] - SENIORITY_ORDER[a])[0] || "";
}

function seniorityScore(profileSeniority, jobSeniority) {
  const profile = normalizeTerm(profileSeniority);
  const job = normalizeTerm(jobSeniority);
  if (!profile || !job || SENIORITY_ORDER[profile] === undefined || SENIORITY_ORDER[job] === undefined) return 75;
  if (SENIORITY_ORDER[job] <= SENIORITY_ORDER[profile]) return 100;
  return SENIORITY_ORDER[job] - SENIORITY_ORDER[profile] === 1 ? 70 : 35;
}

function calculateProfileMatch(job, profile) {
  const text = [job.jobTitle, job.company, job.jobDescription].join(" ");
  const classified = classifyJob(text);
  const required = classified.keywords;
  const skillSet = new Set([
    ...(profile.skillItems || []).map((skill) => skill.name),
    ...collectLearnedSkillItems(profile).map((skill) => skill.name),
  ].map(normalizeTerm));
  const matchedSkills = required.filter((keyword) => skillSet.has(normalizeTerm(keyword)));
  const skillsScore = required.length ? Math.round((matchedSkills.length / required.length) * 100) : 0;
  const jobSeniority = inferSeniority(text);
  const seniorityMatchScore = seniorityScore(profile.seniority, jobSeniority);
  const score = Math.round(skillsScore * 0.65 + seniorityMatchScore * 0.35);
  return {
    score,
    matchedSkills,
    missingSkills: required.filter((keyword) => !matchedSkills.includes(keyword)),
    profileSeniority: profile.seniority || "",
    jobSeniority,
    seniorityMatchScore,
  };
}

async function createSharedMatchedJob(db, data) {
  return db.sharedMatchedJob.create({
    data: {
      jobTitle: data.jobTitle,
      company: data.company,
      jobUrl: data.linkVaga,
      jobDescription: data.jobDescription || "",
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
        createdAt: job.data,
        origin: "tracking",
      })),
    ]);
  });
  const profile = await profileService.getProfile(userId);
  return jobs
    .filter((job) => new Date(job.createdAt) >= cutoff)
    .map((job) => ({
      ...job,
      profileMatch: calculateProfileMatch(job, profile),
    }));
}

module.exports = { PERIOD_DAYS, periodCutoff, dedupeLatestJobs, createSharedMatchedJob, listSharedMatchedJobs };
