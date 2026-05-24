class GoogleDocsExportService {
  async createFromResumeTemplate() {
    const err = new Error("Exportacao para Google Docs ainda nao esta habilitada no MVP");
    err.statusCode = 501;
    throw err;
  }

  async getExportUrl() {
    return null;
  }

  async saveExportMetadata(prisma, data) {
    return prisma.googleDocsExport.create({ data });
  }
}

module.exports = { GoogleDocsExportService };
