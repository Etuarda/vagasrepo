-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "linkVaga" TEXT NOT NULL,
    "linkCV" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "fase" TEXT NOT NULL,
    "acaoNecessaria" BOOLEAN NOT NULL,
    "qualAcao" TEXT,
    "prazoAcao" DATETIME,
    "feedbackBool" BOOLEAN NOT NULL,
    "feedbackTxt" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_fase_idx" ON "Job"("fase");
