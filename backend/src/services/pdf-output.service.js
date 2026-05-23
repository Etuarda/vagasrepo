const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const PAGE = { width: 595.32, height: 841.92 };
const MARGIN = 42;

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(items) {
  return [...new Set((items || []).map(safeText).filter(Boolean))];
}

function limitText(value, max = 420) {
  const text = safeText(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}.` : text;
}

function drawWrappedText(page, text, options) {
  const { x, y, size, font, color, maxWidth, lineHeight } = options;
  const words = safeText(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);

  let cursorY = y;
  lines.forEach((lineText) => {
    page.drawText(lineText, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  });

  return cursorY;
}

function ensurePage(ctx, needed = 70) {
  if (ctx.y > needed) return;
  ctx.page = ctx.pdfDoc.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - MARGIN;
}

function sectionTitle(ctx, title) {
  ensurePage(ctx, 70);
  ctx.y -= 8;
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 8.5,
    font: ctx.bold,
    color: ctx.accent,
  });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.7,
    color: ctx.line,
  });
  ctx.y -= 13;
}

function drawCompactList(ctx, items) {
  const text = unique(items).join(" | ");
  if (!text) return;
  ensurePage(ctx, 45);
  ctx.y = drawWrappedText(ctx.page, text, {
    x: MARGIN,
    y: ctx.y,
    size: 8.5,
    font: ctx.font,
    color: ctx.ink,
    maxWidth: PAGE.width - MARGIN * 2,
    lineHeight: 11,
  });
  ctx.y -= 7;
}

function drawItem(ctx, title, meta, bullets = [], links = []) {
  ensurePage(ctx, 105);
  ctx.page.drawText(limitText(title, 120), {
    x: MARGIN,
    y: ctx.y,
    size: 10,
    font: ctx.bold,
    color: ctx.ink,
  });
  ctx.y -= 12;

  if (meta) {
    ctx.y = drawWrappedText(ctx.page, meta, {
      x: MARGIN,
      y: ctx.y,
      size: 7.8,
      font: ctx.font,
      color: ctx.muted,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 10,
    });
    ctx.y -= 2;
  }

  bullets.filter(Boolean).slice(0, 3).forEach((bullet) => {
    ensurePage(ctx, 35);
    ctx.page.drawText("-", { x: MARGIN, y: ctx.y, size: 8.5, font: ctx.font, color: ctx.ink });
    ctx.y = drawWrappedText(ctx.page, limitText(bullet, 220), {
      x: MARGIN + 12,
      y: ctx.y,
      size: 8.5,
      font: ctx.font,
      color: ctx.ink,
      maxWidth: PAGE.width - MARGIN * 2 - 12,
      lineHeight: 11,
    });
    ctx.y -= 2;
  });

  links.filter((link) => link.value).forEach((link) => {
    ctx.y = drawWrappedText(ctx.page, `${link.label}: ${link.value}`, {
      x: MARGIN + 12,
      y: ctx.y,
      size: 7.5,
      font: ctx.font,
      color: ctx.accent,
      maxWidth: PAGE.width - MARGIN * 2 - 12,
      lineHeight: 10,
    });
  });

  ctx.y -= 8;
}

function scoreItem(item, keywords) {
  const source = safeText([
    item.title,
    item.description,
    item.role,
    item.company,
    ...(item.technologies || []),
  ].join(" ")).toLowerCase();
  return keywords.filter((keyword) => source.includes(String(keyword).toLowerCase())).length;
}

function prioritize(items, keywords) {
  return [...(items || [])].sort((a, b) => scoreItem(b, keywords) - scoreItem(a, keywords));
}

function drawHeader(ctx, profile) {
  ctx.page.drawText(safeText(profile.name), {
    x: MARGIN,
    y: ctx.y,
    size: 20,
    font: ctx.bold,
    color: ctx.ink,
  });
  ctx.y -= 16;

  const contact = [
    profile.title,
    profile.emailContact,
    profile.phone,
    profile.linkedin,
    profile.github,
    profile.lattes,
  ].filter(Boolean);

  if (contact.length) {
    ctx.y = drawWrappedText(ctx.page, contact.join(" | "), {
      x: MARGIN,
      y: ctx.y,
      size: 7.8,
      font: ctx.font,
      color: ctx.muted,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 10,
    });
  }

  ctx.y -= 8;
}

async function generateOptimizedResumePdf({ profile, matchResult }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ctx = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN,
    font,
    bold,
    ink: rgb(0.08, 0.075, 0.065),
    muted: rgb(0.32, 0.30, 0.27),
    line: rgb(0.78, 0.76, 0.72),
    accent: rgb(0.18, 0.20, 0.28),
  };

  const keywords = unique([...(matchResult.matchedTechnologies || []), ...(matchResult.matchedSkills || [])]);
  const prioritizedSkills = unique([...keywords, ...(profile.skills || [])]).slice(0, 24);
  const projects = prioritize(
    matchResult.selectedProjects?.length ? matchResult.selectedProjects : profile.projects,
    keywords
  ).slice(0, 4);
  const experiences = prioritize(profile.experiences || [], keywords).slice(0, 5);

  drawHeader(ctx, profile);

  sectionTitle(ctx, "Resumo profissional");
  ctx.y = drawWrappedText(ctx.page, limitText(matchResult.suggestedSummary || profile.summary, 620), {
    x: MARGIN,
    y: ctx.y,
    size: 8.8,
    font,
    color: ctx.ink,
    maxWidth: PAGE.width - MARGIN * 2,
    lineHeight: 11.5,
  });
  ctx.y -= 6;

  sectionTitle(ctx, "Formacao academica");
  const academic = (profile.courses || []).filter((course) => /gradua|bacharel|licenciatura|tecnologo|faculdade|universidade|superior/i.test(`${course.title} ${course.institution}`));
  if (academic.length) {
    academic.slice(0, 3).forEach((course) => {
      drawItem(ctx, course.title, [course.institution, course.period].filter(Boolean).join(" | "), [course.description]);
    });
  } else {
    drawCompactList(ctx, ["Nao informado no perfil."]);
  }

  sectionTitle(ctx, "Projetos");
  projects.forEach((project) => {
    const meta = [
      project.technologies?.length ? `Tecnologias: ${project.technologies.join(", ")}` : "",
    ].filter(Boolean).join(" | ");
    drawItem(ctx, project.title, meta, [project.description], [
      { label: "Repositorio", value: project.repositoryUrl },
      { label: "Deploy", value: project.deployUrl },
    ]);
  });

  sectionTitle(ctx, "Experiencia profissional");
  experiences.forEach((experience) => {
    drawItem(
      ctx,
      `${experience.role}${experience.company ? ` | ${experience.company}` : ""}`,
      experience.period,
      [experience.description]
    );
  });

  sectionTitle(ctx, "Habilidades tecnicas");
  drawCompactList(ctx, prioritizedSkills);

  sectionTitle(ctx, "Cursos e certificacoes");
  const nonAcademicCourses = (profile.courses || []).filter((course) => !academic.some((item) => item.id === course.id));
  nonAcademicCourses.slice(0, 5).forEach((course) => {
    drawItem(ctx, course.title, [course.institution, course.period].filter(Boolean).join(" | "), [course.description]);
  });
  (profile.certifications || []).slice(0, 5).forEach((cert) => {
    drawItem(ctx, cert.title, [cert.issuer, cert.period].filter(Boolean).join(" | "), [], [
      { label: "Credencial", value: cert.credentialUrl },
    ]);
  });

  sectionTitle(ctx, "Idiomas");
  drawCompactList(ctx, (profile.languages || []).map((item) => [item.name, item.level].filter(Boolean).join(" - ")));

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateOptimizedResumePdf };
