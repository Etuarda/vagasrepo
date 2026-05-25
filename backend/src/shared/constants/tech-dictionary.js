const TECH_ALIASES = {
  nodejs: ["node", "nodejs", "node.js", "node js"],
  postgresql: ["postgres", "postgresql", "postgres sql"],
  react: ["react", "react.js", "reactjs"],
  "api-rest": ["rest api", "api rest", "apis rest", "restful api", "apis restful", "rest"],
  "docker-compose": ["docker compose", "docker-compose"],
  javascript: ["javascript", "java script", "js"],
  typescript: ["typescript", "type script", "ts"],
  "power-bi": ["powerbi", "power bi"],
  "looker-studio": ["looker", "looker studio"],
  "ci-cd": ["ci/cd", "ci cd", "continuous integration", "continuous delivery"],
  "clean-architecture": ["clean architecture", "arquitetura limpa"],
  "clean-code": ["clean code"],
  agile: ["agile", "agil", "agile methodology"],
  "metodologias-ageis": ["metodologias ageis", "metodologia agil", "metodos ageis"],
  "versionamento-de-codigo": ["versionamento de codigo", "controle de versao", "version control"],
  accessibility: ["accessibility", "acessibilidade", "wcag"],
};

const CATEGORY_KEYWORDS = {
  backend: ["nodejs", "express", "nestjs", "api-rest", "jwt", "prisma", "postgresql", "microservices", "clean-architecture"],
  frontend: ["react", "html", "css", "javascript", "typescript", "responsive-design", "accessibility"],
  fullstack: ["react", "nodejs", "typescript", "api-rest", "postgresql", "javascript"],
  data: ["python", "pandas", "sql", "etl", "power-bi", "looker-studio", "dashboard", "metricas", "storytelling", "analise-exploratoria"],
  ai: ["python", "machine-learning", "nlp", "modelagem", "pandas", "scikit-learn"],
  devops: ["docker", "docker-compose", "ci-cd", "deploy", "cloud", "linux", "aws"],
  qa: ["testing", "jest", "cypress", "playwright", "qa", "automacao"],
  product: ["produto", "discovery", "roadmap", "metricas", "analytics", "ux"],
};

const SKILL_GROUPS = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Fullstack",
  data: "Dados/Banco",
  database: "Dados/Banco",
  ai: "Python/BI",
  devops: "DevOps/Qualidade",
  qa: "DevOps/Qualidade",
  quality: "DevOps/Qualidade",
  product: "Produto",
  other: "Outras",
};

const TRANSVERSAL_SKILLS = [
  "git",
  "github",
  "scrum",
  "kanban",
  "agile",
  "metodologias-ageis",
  "versionamento-de-codigo",
  "clean-code",
  "solid",
];

module.exports = { TECH_ALIASES, CATEGORY_KEYWORDS, SKILL_GROUPS, TRANSVERSAL_SKILLS };
