-- CreateTable
CREATE TABLE "ResumeFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "extractedText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeFile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OptimizedResume" ADD COLUMN "resumeFileId" TEXT;

-- CreateIndex
CREATE INDEX "ResumeFile_userId_idx" ON "ResumeFile"("userId");
CREATE INDEX "ResumeFile_createdAt_idx" ON "ResumeFile"("createdAt");
CREATE INDEX "OptimizedResume_resumeFileId_idx" ON "OptimizedResume"("resumeFileId");

-- AddForeignKey
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizedResume" ADD CONSTRAINT "OptimizedResume_resumeFileId_fkey" FOREIGN KEY ("resumeFileId") REFERENCES "ResumeFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
