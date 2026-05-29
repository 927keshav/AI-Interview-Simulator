-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentQuestionId" TEXT;

-- CreateIndex
CREATE INDEX "Question_parentQuestionId_idx" ON "Question"("parentQuestionId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
