# Matching Rules

## Engine

The system uses a deterministic engine. It does not invent skills and does not use generative AI.

Single source of truth:

```text
backend/src/modules/matching/job-match-evaluator.service.js
```

The same evaluator must be used by:

- individual ATS matching;
- shared jobs;
- optimized resume selection;
- analysis history and recalculation.

## Base formula

The auditable base score is:

```text
aderenciaBase = (skillsScore * 0.70) + (projectsScore * 0.30)
```

`skillsScore` is based on profile skills plus learned skills collected from education, projects, courses and certifications.

`projectsScore` is based on compatible learned skills, technical description, repository link, deploy link and category/stack evidence.

## Seniority adjustment

Seniority does not replace the base formula. It is applied after the base score as a cap or light penalty.

Examples:

| Profile | Job | Result |
| --- | --- | --- |
| internship | senior | max score 45 |
| junior | senior | max score 55 |
| junior | mid | max score 70 |
| mid | senior | max score 80 |
| unknown | any | light penalty |
| senior | junior | high score allowed, warning flag |

The response exposes:

- `aderenciaBase`;
- `overallScore`;
- `seniorityPenalty`;
- `seniorityMatch`;
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

Shared jobs must not expose full `jobDescription` in public listing responses. The description can be used internally to calculate:

- global profile match;
- best subprofile match;
- matched skills;
- main gaps.

## Regression tests

Before changing the evaluator, update and run:

```bash
cd backend
npm test -- job-match-evaluator.service.test.js shared-matched-jobs.service.test.js matching.service.test.js
```
