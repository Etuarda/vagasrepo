const { PDFDocument, PDFName, PDFArray } = require("pdf-lib");
const { generateOptimizedResumePdf } = require("../pdf-output.service");

describe("optimized resume PDF", () => {
  it("renderiza links independentes e clicaveis no PDF", async () => {
    const content = await generateOptimizedResumePdf({
      compiledResume: {
        header: {
          name: "Pessoa Teste",
          title: "Backend Developer",
          location: "Fortaleza/CE",
          phone: "85999999999",
          email: "pessoa@example.com",
          github: "https://github.com/pessoa",
          linkedin: "https://linkedin.com/in/pessoa",
          lattes: "https://lattes.cnpq.br/pessoa",
        },
        summary: "Resumo integral cadastrado.",
        education: [],
        experiences: [],
        projects: [{
          title: "API",
          category: "Backend",
          repositoryUrl: "https://github.com/pessoa/api",
          deployUrl: "https://api.example.com",
          stack: "Node.js",
          summary: "Projeto cadastrado.",
          bullets: [],
        }],
        skillsInline: "Backend: Node.js",
        certifications: [{ title: "Certificado", credentialUrl: "https://example.com/credencial" }],
        courses: [],
        languagesInline: "Ingles - B1",
      },
    });
    const pdf = await PDFDocument.load(content);
    const totalAnnotations = pdf.getPages().reduce((total, page) => {
      const annotations = page.node.lookup(PDFName.of("Annots"), PDFArray);
      return total + (annotations ? annotations.size() : 0);
    }, 0);
    expect(totalAnnotations).toBe(7);
  });
});
