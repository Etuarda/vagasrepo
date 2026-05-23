ALTER TABLE "User" ADD COLUMN "lattes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CareerProfile" ADD COLUMN "lattes" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Language_userId_idx" ON "Language"("userId");
CREATE INDEX "Language_profileId_idx" ON "Language"("profileId");

ALTER TABLE "Language" ADD CONSTRAINT "Language_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Language" ADD CONSTRAINT "Language_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
