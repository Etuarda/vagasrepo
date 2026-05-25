const fs = require("fs");
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = require("pdf-lib");
const { compileResume } = require("../modules/resume/resume-compiler.service");

const PAGE = { width: 595.32, height: 841.92 };
const MARGIN = 37;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toUrl(value) {
  const target = text(value);
  if (!target) return "";
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
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

function newPage(ctx) {
  ctx.page = ctx.pdf.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - MARGIN;
}

function ensureSpace(ctx, height) {
  if (ctx.y - height >= MARGIN) return;
  newPage(ctx);
}

function addLink(ctx, x, y, width, size, uri) {
  if (!uri || !width) return;
  const annotation = ctx.pdf.context.register(ctx.pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y - 2, x + width, y + size + 2],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
  }));
  const annotations = ctx.annotations.get(ctx.page) || [];
  annotations.push(annotation);
  ctx.annotations.set(ctx.page, annotations);
  ctx.page.node.set(PDFName.of("Annots"), ctx.pdf.context.obj(annotations));
}

function write(ctx, value, { size = 11, font = ctx.font, color = ctx.ink, indent = 0, lineHeight = 14 } = {}) {
  if (!text(value)) return;
  wrap(font, value, size, CONTENT_WIDTH - indent).forEach((line) => {
    ensureSpace(ctx, lineHeight);
    ctx.page.drawText(line, { x: MARGIN + indent, y: ctx.y, size, font, color });
    ctx.y -= lineHeight;
  });
}

function writeSegments(ctx, segments, { size = 10, font = ctx.font, lineHeight = 13 } = {}) {
  const separator = " | ";
  let x = MARGIN;
  let hasItem = false;
  const beginLine = () => {
    ensureSpace(ctx, lineHeight);
    x = MARGIN;
    hasItem = false;
  };
  beginLine();

  (segments || []).filter((item) => text(item.label)).forEach((item) => {
    const label = text(item.label);
    const separatorWidth = hasItem ? font.widthOfTextAtSize(separator, size) : 0;
    const labelWidth = font.widthOfTextAtSize(label, size);
    if (hasItem && x + separatorWidth + labelWidth > PAGE.width - MARGIN) {
      ctx.y -= lineHeight;
      beginLine();
    }
    if (hasItem) {
      ctx.page.drawText(separator, { x, y: ctx.y, size, font, color: ctx.muted });
      x += separatorWidth;
    }
    const color = item.uri ? ctx.link : ctx.muted;
    ctx.page.drawText(label, { x, y: ctx.y, size, font, color });
    addLink(ctx, x, ctx.y, labelWidth, size, item.uri);
    x += labelWidth;
    hasItem = true;
  });
  if (hasItem) ctx.y -= lineHeight;
}

function section(ctx, label) {
  ensureSpace(ctx, 42);
  ctx.y -= 10;
  ctx.page.drawText(label.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 13,
    font: ctx.bold,
    color: ctx.accent,
  });
  ctx.y -= 7;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.6,
    color: ctx.line,
  });
  ctx.y -= 18;
}

function bullet(ctx, value) {
  if (!text(value)) return;
  ensureSpace(ctx, 14);
  ctx.page.drawText("-", { x: MARGIN + 2, y: ctx.y, size: 10.5, font: ctx.font, color: ctx.ink });
  write(ctx, value, { indent: 14, size: 10.5, lineHeight: 13.5 });
}

function configuredFontPath(envName, fileName) {
  const configured = process.env[envName];
  const windowsFont = process.platform === "win32"
    ? path.join(process.env.WINDIR || "C:\\Windows", "Fonts", fileName)
    : "";
  return [configured, windowsFont].find((candidate) => candidate && fs.existsSync(candidate));
}

async function embedFonts(pdf) {
  const regularPath = configuredFontPath("RESUME_FONT_PATH", "arial.ttf");
  const boldPath = configuredFontPath("RESUME_BOLD_FONT_PATH", "arialbd.ttf") || regularPath;
  if (regularPath) {
    pdf.registerFontkit(fontkit);
    return {
      font: await pdf.embedFont(fs.readFileSync(regularPath), { subset: true }),
      bold: await pdf.embedFont(fs.readFileSync(boldPath), { subset: true }),
    };
  }
  return {
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

async function generateOptimizedResumePdf({ profile, matchResult, compiledResume }) {
  const resume = compiledResume || compileResume({ profile, matchResult });
  const pdf = await PDFDocument.create();
  const { font, bold } = await embedFonts(pdf);
  const ctx = {
    pdf,
    page: null,
    y: 0,
    font,
    bold,
    annotations: new Map(),
    ink: rgb(0.067, 0.067, 0.067),
    muted: rgb(0.29, 0.29, 0.29),
    accent: rgb(0.102, 0.212, 0.365),
    link: rgb(0.02, 0.388, 0.757),
    line: rgb(0.82, 0.84, 0.87),
  };
  newPage(ctx);

  write(ctx, resume.header.name, { size: 23, font: bold, lineHeight: 29 });
  if (resume.header.title) write(ctx, resume.header.title, { size: 11, font: bold, lineHeight: 16 });
  writeSegments(ctx, [
    { label: resume.header.location },
    { label: resume.header.phone },
    { label: resume.header.email, uri: resume.header.email ? `mailto:${resume.header.email}` : "" },
  ]);
  writeSegments(ctx, [
    { label: resume.header.github && "GitHub", uri: toUrl(resume.header.github) },
    { label: resume.header.linkedin && "LinkedIn", uri: toUrl(resume.header.linkedin) },
    { label: resume.header.lattes && "Lattes", uri: toUrl(resume.header.lattes) },
  ]);

  if (resume.summary) {
    section(ctx, "Resumo profissional");
    write(ctx, resume.summary);
  }
  if (resume.education.length) {
    section(ctx, "Formacao academica");
    resume.education.forEach((item) => {
      write(ctx, item.title, { font: bold });
      write(ctx, [item.institution, item.period].filter(Boolean).join(" | "), { size: 10, color: ctx.muted, lineHeight: 13 });
      ctx.y -= 4;
    });
  }
  if (resume.experiences.length) {
    section(ctx, "Experiencia profissional");
    resume.experiences.forEach((item) => {
      write(ctx, item.title, { font: bold });
      write(ctx, [item.period, item.workload].filter(Boolean).join(" | "), { size: 10, color: ctx.muted, lineHeight: 13 });
      bullet(ctx, item.description);
      ctx.y -= 4;
    });
  }
  if (resume.projects.length) {
    section(ctx, "Projetos");
    resume.projects.forEach((item) => {
      write(ctx, [item.title, item.category].filter(Boolean).join(" - "), { font: bold });
      writeSegments(ctx, [
        { label: item.repositoryUrl && "GitHub", uri: toUrl(item.repositoryUrl) },
        { label: item.deployUrl && "Deploy", uri: toUrl(item.deployUrl) },
      ], { size: 10.5 });
      if (item.stack) write(ctx, `Tecnologias: ${item.stack}`, { size: 10, color: ctx.muted, lineHeight: 13 });
      write(ctx, item.summary);
      item.bullets.forEach((value) => bullet(ctx, value));
      ctx.y -= 4;
    });
  }
  if (resume.skillsInline) {
    section(ctx, "Habilidades e competencias");
    write(ctx, resume.skillsInline);
  }
  if (resume.certifications.length || resume.courses.length) {
    section(ctx, "Certificacoes / Cursos");
    resume.certifications.forEach((item) => {
      const title = item.workload ? `${item.title} (${item.workload})` : item.title;
      write(ctx, [title, item.issuer, item.period].filter(Boolean).join(" | "), { font: bold });
      if (item.credentialUrl) writeSegments(ctx, [{ label: "Credencial", uri: toUrl(item.credentialUrl) }], { size: 10.5 });
    });
    resume.courses.forEach((item) => {
      const title = item.workload ? `${item.title} (${item.workload})` : item.title;
      write(ctx, [title, item.institution, item.period].filter(Boolean).join(" | "), { font: bold });
      if (item.description) write(ctx, item.description);
    });
  }
  if (resume.languagesInline) {
    section(ctx, "Idiomas");
    write(ctx, resume.languagesInline);
  }

  return Buffer.from(await pdf.save());
}

module.exports = { generateOptimizedResumePdf };
