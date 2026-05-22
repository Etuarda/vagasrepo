const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function drawWrappedText(page, text, options) {
  const { x, y, size, font, color, maxWidth, lineHeight } = options;
  const words = safeText(text).split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
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

async function generateOptimizedResumePdf({ basePdfBuffer, profile, matchResult }) {
  const pdfDoc = basePdfBuffer
    ? await PDFDocument.load(basePdfBuffer)
    : await PDFDocument.create();

  const page = pdfDoc.addPage([595.32, 841.92]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.06, 0.05);
  const muted = rgb(0.31, 0.28, 0.25);
  const line = rgb(0.81, 0.79, 0.76);

  page.drawText("Otimização ATS", { x: 48, y: 780, size: 24, font: bold, color: ink });
  page.drawText(`Candidato: ${safeText(profile.name)}`, { x: 48, y: 748, size: 11, font, color: muted });
  page.drawText(`Vaga analisada: ${safeText(matchResult.targetTitle)}`, { x: 48, y: 730, size: 11, font, color: muted });
  page.drawText(`Score: ${matchResult.scoreDetails.totalScore}%`, { x: 48, y: 705, size: 16, font: bold, color: ink });
  page.drawLine({ start: { x: 48, y: 682 }, end: { x: 547, y: 682 }, thickness: 1, color: line });

  let y = 650;
  page.drawText("Resumo sugerido", { x: 48, y, size: 14, font: bold, color: ink });
  y = drawWrappedText(page, matchResult.suggestedSummary, {
    x: 48,
    y: y - 24,
    size: 10,
    font,
    color: muted,
    maxWidth: 500,
    lineHeight: 14,
  });

  y -= 24;
  page.drawText("Skills priorizadas", { x: 48, y, size: 14, font: bold, color: ink });
  y = drawWrappedText(page, (matchResult.matchedSkills || []).join(", ") || "Nenhuma skill aderente encontrada.", {
    x: 48,
    y: y - 24,
    size: 10,
    font,
    color: muted,
    maxWidth: 500,
    lineHeight: 14,
  });

  y -= 24;
  page.drawText("Tecnologias priorizadas", { x: 48, y, size: 14, font: bold, color: ink });
  y = drawWrappedText(page, (matchResult.matchedTechnologies || []).join(", ") || "Nenhuma tecnologia aderente encontrada.", {
    x: 48,
    y: y - 24,
    size: 10,
    font,
    color: muted,
    maxWidth: 500,
    lineHeight: 14,
  });

  y -= 24;
  page.drawText("Projetos recomendados", { x: 48, y, size: 14, font: bold, color: ink });
  y -= 24;

  const projects = matchResult.selectedProjects || [];
  if (!projects.length) {
    y = drawWrappedText(page, "Cadastre projetos no perfil para gerar seleção automática.", {
      x: 48,
      y,
      size: 10,
      font,
      color: muted,
      maxWidth: 500,
      lineHeight: 14,
    });
  } else {
    projects.forEach((project) => {
      page.drawText(safeText(project.title), { x: 48, y, size: 11, font: bold, color: ink });
      y = drawWrappedText(page, safeText(project.description), {
        x: 48,
        y: y - 18,
        size: 9,
        font,
        color: muted,
        maxWidth: 500,
        lineHeight: 13,
      });
      y = drawWrappedText(page, `Tecnologias: ${(project.technologies || []).join(", ")}`, {
        x: 48,
        y: y - 6,
        size: 9,
        font,
        color: muted,
        maxWidth: 500,
        lineHeight: 13,
      });
      y -= 16;
    });
  }

  page.drawText("Observação: as páginas originais foram preservadas sem alteração de layout.", {
    x: 48,
    y: 42,
    size: 8,
    font,
    color: muted,
  });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateOptimizedResumePdf };
