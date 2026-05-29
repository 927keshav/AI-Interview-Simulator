-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "interviewerNotes" TEXT,
ADD COLUMN     "metadata" JSONB;
