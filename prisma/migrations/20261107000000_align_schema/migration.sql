-- CreateEnum
CREATE TYPE "FineTargetType" AS ENUM ('SQUAD', 'USER');

-- CreateEnum
CREATE TYPE "FineProposalStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'CAPITAL_SOURCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'CAPITAL_INJECTION';
ALTER TYPE "TransactionType" ADD VALUE 'RESERVE_SWEEP';
ALTER TYPE "TransactionType" ADD VALUE 'PERSONAL_FUNDING';

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolFundingRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "memo" VARCHAR(500) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PoolFundingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionResetLog" (
    "id" TEXT NOT NULL,
    "resetById" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionResetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineProposal" (
    "id" TEXT NOT NULL,
    "targetType" "FineTargetType" NOT NULL,
    "targetSquadId" TEXT,
    "targetUserId" TEXT,
    "proposedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FineProposalStatus" NOT NULL DEFAULT 'PENDING',
    "ledgerTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "FineProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_userId_key" ON "TaskAssignee"("taskId", "userId");

-- CreateIndex
CREATE INDEX "PoolFundingRequest_status_createdAt_idx" ON "PoolFundingRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FineProposal_status_createdAt_idx" ON "FineProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FineProposal_targetSquadId_idx" ON "FineProposal"("targetSquadId");

-- CreateIndex
CREATE INDEX "FineProposal_targetUserId_idx" ON "FineProposal"("targetUserId");

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolFundingRequest" ADD CONSTRAINT "PoolFundingRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolFundingRequest" ADD CONSTRAINT "PoolFundingRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionResetLog" ADD CONSTRAINT "ProductionResetLog_resetById_fkey" FOREIGN KEY ("resetById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineProposal" ADD CONSTRAINT "FineProposal_targetSquadId_fkey" FOREIGN KEY ("targetSquadId") REFERENCES "Squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineProposal" ADD CONSTRAINT "FineProposal_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineProposal" ADD CONSTRAINT "FineProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineProposal" ADD CONSTRAINT "FineProposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

