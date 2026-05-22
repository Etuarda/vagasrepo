const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const PAGE = { width: 595.32, height: 841.92 };
const MARGIN = 46;

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function ensurePage(ctx, needed = 80) {
  if (ctx.y > needed) return;
  ctx.page = ctx.pdfDoc.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - MARGIN;
}

function sectionTitle(ctx, title) {
  ensurePage(ctx, 70);
  ctx.y -= 12;
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: ctx.bold,
    color: ctx.accent,
  });
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.8,
    color: ctx.line,
  });
  ctx.y -= 18;
}

function bulletList(ctx, items) {
  items.filter(Boolean).forEach((item) => {
    ensurePage(ctx, 50);
    ctx.page.drawText("•", { x: MARGIN, y: ctx.y, size: 9, font: ctx.font, color: ctx.ink });
    ctx.y = drawWrappedText(ctx.page, item, {
      x: MARGIN + 14,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: ctx.ink,
      maxWidth: PAGE.width - MARGIN * 2 - 14,
      lineHeight: 12,
    });
    ctx.y -= 5;
  });
}

function drawItem(ctx, title, meta, description, links = []) {
  ensurePage(ctx, 110);
  ctx.page.drawText(safeText(title), {
    x: MARGIN,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: ctx.ink,
  });
  ctx.y -= 14;

  if (meta) {
    ctx.y = drawWrappedText(ctx.page, meta, {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font: ctx.font,
      color: ctx.muted,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 11,
    });
    ctx.y -= 4;
  }

  if (description) {
    ctx.y = drawWrappedText(ctx.page, description, {
      x: MARGIN,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: ctx.ink,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 12,
    });
    ctx.y -= 4;
  }

  links.filter((link) => link.value).forEach((link) => {
    ctx.y = drawWrappedText(ctx.page, `${link.label}: ${link.value}`, {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font: ctx.font,
      color: ctx.accent,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 11,
    });
  });

  ctx.y -= 12;
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
    accent: rgb(0.22, 0.23, 0.30),
  };

  const contact = [
    profile.emailContact,
    profile.phone,
    profile.location,
    profile.linkedin,
    profile.github,
  ].filter(Boolean);

  ctx.page.drawText(safeText(profile.name), {
    x: MARGIN,
    y: ctx.y,
    size: 24,
    font: bold,
    color: ctx.ink,
  });
  ctx.y -= 22;

  if (profile.title) {
    ctx.page.drawText(safeText(profile.title), {
      x: MARGIN,
      y: ctx.y,
      size: 12,
      font: bold,
      color: ctx.accent,
    });
    ctx.y -= 16;
  }

  if (contact.length) {
    ctx.y = drawWrappedText(ctx.page, contact.join(" | "), {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font,
      color: ctx.muted,
      maxWidth: PAGE.width - MARGIN * 2,
      lineHeight: 11,
    });
    ctx.y -= 8;
  }

  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 1,
    color: ctx.line,
  });
  ctx.y -= 18;

  sectionTitle(ctx, "Resumo profissional");
  ctx.y = drawWrappedText(ctx.page, matchResult.suggestedSummary || profile.summary, {
    x: MARGIN,
    y: ctx.y,
    size: 9.5,
    font,
    color: ctx.ink,
    maxWidth: PAGE.width - MARGIN * 2,
    lineHeight: 13,
  });
  ctx.y -= 10;

  const prioritizedSkills = [
    ...(matchResult.matchedTechnologies || []),
    ...(matchResult.matchedSkills || []),
  ];
  const skills = prioritizedSkills.length ? prioritizedSkills : profile.skills || [];

  if (skills.length) {
    sectionTitle(ctx, "Habilidades");
    bulletList(ctx, [...new Set(skills)].slice(0, 20));
  }

  if (profile.experiences?.length) {
    sectionTitle(ctx, "Experiência profissional");
    profile.experiences.slice(0, 5).forEach((exp) => {
      drawItem(
        ctx,
        `${exp.role}${exp.company ? ` | ${exp.company}` : ""}`,
        exp.period,
        exp.description
      );
    });
  }

  const selectedProjects = matchResult.selectedProjects?.length
    ? matchResult.selectedProjects
    : profile.projects || [];

  if (selectedProjects.length) {
    sectionTitle(ctx, "Projetos destacados");
    selectedProjects.slice(0, 3).forEach((project) => {
      const techs = project.technologies?.length ? `Tecnologias: ${project.technologies.join(", ")}` : "";
      drawItem(ctx, project.title, techs, project.description, [
        { label: "Repositório", value: project.repositoryUrl },
        { label: "Deploy", value: project.deployUrl },
      ]);
    });
  }

  if (profile.courses?.length) {
    sectionTitle(ctx, "Cursos");
    profile.courses.slice(0, 5).forEach((course) => {
      drawItem(ctx, course.title, [course.institution, course.period].filter(Boolean).join(" | "), course.description);
    });
  }

  if (profile.certifications?.length) {
    sectionTitle(ctx, "Certificações");
    profile.certifications.slice(0, 5).forEach((cert) => {
      drawItem(ctx, cert.title, [cert.issuer, cert.period].filter(Boolean).join(" | "), "", [
        { label: "Credencial", value: cert.credentialUrl },
      ]);
    });
  }

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateOptimizedResumePdf };
