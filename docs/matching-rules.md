# Matching Rules

## Engine

The system uses a deterministic engine. It does not invent skills and does not use generative AI.

Single source of truth:

```text
backend/src/modules/matching/job-match-evaluator.service.js
```

The same evaluator must be used by:

- individual ATS matching;
- optimized resume selection;
- analysis history and recalculation.

## Base formula

The auditable base score is:

```text
aderenciaBase = (skillsScore * 0.70) + (projectsScore * 0.30)
```

`skillsScore` is based on profile skills plus learned skills collected from education, projects, courses and certifications.

`projectsScore` is based on compatible learned skills, technical description, repository link, deploy link and category/stack evidence.

## Seniority

Seniority is not part of the ATS score. The profile form must not require seniority, and the evaluator must not cap or penalize a score based on seniority.

The response exposes:

- `aderenciaBase`;
- `overallScore`;
- `riskFlags`;
- `warnings`;
- `scoringVersion`.

## Incomplete analysis

The UI must not display `0%` when a score was not calculated. It must display an incomplete state when:

- job description is missing;
- profile data is insufficient;
- required learned skills are missing;
- matching was not executed successfully.

## Shared jobs

Shared jobs must not expose full `jobDescription` in listing responses and must not calculate ATS score. The endpoint returns only public opportunity metadata:

- title;
- company;
- link;
- origin;
- date.

## Regression tests

Before changing the evaluator, update and run:

```bash
cd backend
npm test -- job-match-evaluator.service.test.js shared-matched-jobs.service.test.js matching.service.test.js
```
