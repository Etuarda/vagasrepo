const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { compileResume } = require("../modules/resume/resume-compiler.service");

const PAGE = { width: 595.32, height: 841.92 };
const MARGIN = 37;

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function wrap(font, value, size, maxWidth) {
  const lines = [];
  let current = "";
  text(value).split(" ").filter(Boolean).forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function ensureSpace(ctx, lines = 2) {
  if (ctx.y >= MARGIN + lines * 10) return;
  ctx.page = ctx.pdf.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - MARGIN;
}

function write(ctx, value, { size = 8.2, font = ctx.font, color = ctx.ink, indent = 0, lineHeight = 10 } = {}) {
  if (!text(value)) return;
  const lines = wrap(font, value, size, PAGE.width - MARGIN * 2 - indent);
  ensureSpace(ctx, lines.length);
  lines.forEach((line) => {
    ctx.page.drawText(line, { x: MARGIN + indent, y: ctx.y, size, font, color });
    ctx.y -= lineHeight;
  });
}

function section(ctx, label) {
  ensureSpace(ctx, 3);
  ctx.y -= 5;
  ctx.page.drawText(label.toUpperCase(), { x: MARGIN, y: ctx.y, size: 8, font: ctx.bold, color: ctx.accent });
  ctx.y -= 5;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.55,
    color: ctx.line,
  });
  ctx.y -= 11;
}

function bullet(ctx, value) {
  if (!text(value)) return;
  ensureSpace(ctx, 2);
  ctx.page.drawText("-", { x: MARGIN, y: ctx.y, size: 8.2, font: ctx.font, color: ctx.ink });
  write(ctx, value, { indent: 10, size: 8.2, lineHeight: 9.5 });
}

async function generateOptimizedResumePdf({ profile, matchResult, compiledResume }) {
  const resume = compiledResume || compileResume({ profile, matchResult });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx = {
    pdf,
    page: pdf.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN,
    font,
    bold,
    ink: rgb(0.08, 0.08, 0.08),
    muted: rgb(0.34, 0.34, 0.34),
    accent: rgb(0.16, 0.20, 0.28),
    line: rgb(0.80, 0.80, 0.80),
  };

  write(ctx, resume.header.name, { size: 15, font: bold, lineHeight: 17 });
  write(ctx, [resume.header.title, resume.header.contactInline].filter(Boolean).join(" | "), { size: 7.7, color: ctx.muted, lineHeight: 9 });

  if (resume.summary) {
    section(ctx, "Resumo profissional");
    write(ctx, resume.summary);
  }
  if (resume.education.length) {
    section(ctx, "Formacao");
    resume.education.slice(0, 2).forEach((item) => write(ctx, [item.title, item.institution, item.period].filter(Boolean).join(" | ")));
  }
  if (resume.skillsInline) {
    section(ctx, "Habilidades tecnicas");
    write(ctx, resume.skillsInline);
  }
  if (resume.experiences.length) {
    section(ctx, "Experiencia");
    resume.experiences.forEach((item) => {
      write(ctx, [item.title, item.period].filter(Boolean).join(" | "), { font: bold, size: 8.5 });
      item.bullets.forEach((value) => bullet(ctx, value));
    });
  }
  if (resume.projects.length) {
    section(ctx, "Projetos selecionados");
    resume.projects.forEach((item) => {
      write(ctx, [item.title, item.stack, item.links].filter(Boolean).join(" | "), { font: bold, size: 8.5 });
      item.bullets.forEach((value) => bullet(ctx, value));
    });
  }
  if (resume.coursesAndCertificationsInline) {
    section(ctx, "Cursos e certificacoes");
    write(ctx, resume.coursesAndCertificationsInline);
  }
  if (resume.languagesInline) {
    section(ctx, "Idiomas");
    write(ctx, resume.languagesInline);
  }

  return Buffer.from(await pdf.save());
}

module.exports = { generateOptimizedResumePdf };
