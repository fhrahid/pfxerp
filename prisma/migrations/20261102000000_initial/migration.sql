-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CEO', 'CFO', 'CTO', 'CPO', 'PM', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "SquadRole" AS ENUM ('PM', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SQUAD_TREASURY', 'PERSONAL_WALLET', 'SYSTEM_RESERVE', 'ESCROW');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SPRINT_PAYOUT', 'TAX', 'PAYROLL', 'FINE', 'CONSULTANCY', 'BOUNTY', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'EQUITY_INVESTMENT', 'EQUITY_DIVIDEND', 'SWAP_FEE', 'MARKETPLACE_PURCHASE', 'ESCROW_DEPOSIT', 'ESCROW_RELEASE', 'CHAOS_PENALTY', 'CEO_BONUS', 'CODE_AUDIT_FINE', 'SLACKER_FINE', 'SQUAD_FUNDING');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'FLAGGED_COMPLETE', 'PM_VERIFIED', 'CTO_VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PayrollProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollTier" AS ENUM ('STAR_PERFORMER', 'REGULAR', 'UNDERPERFORMER', 'SLACKER');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'REPAID', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'LOW');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('SUBMITTED', 'CTO_VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NoticeCategory" AS ENUM ('DISCIPLINARY', 'APPOINTMENT', 'ORGANIZATIONAL', 'STUDIO_DIRECTIVE');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DISPATCHED', 'DELIVERED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "SquadHealthStatus" AS ENUM ('BULLISH', 'STABLE', 'BANKRUPT_RISK');

-- CreateEnum
CREATE TYPE "BoardDecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'CEO_APPROVED');

-- CreateEnum
CREATE TYPE "DecisionCategory" AS ENUM ('LOAN_APPROVAL', 'SWAP_REQUEST', 'POLICY_CHANGE', 'EMERGENCY_ACTION');

-- CreateEnum
CREATE TYPE "DecisionVoteChoice" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ChaosEventType" AS ENUM ('SCOPE_CREEP', 'LEAD_DEV_SICK_LEAVE', 'SERVER_OUTAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('TIME_AND_MATERIALS', 'FIXED_BID', 'RETAINER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SIGNED', 'ACTIVE', 'COMPLETED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CTO_AUDIT', 'CLIENT_REVIEW', 'PAID');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('CONSULTANT', 'MARKETPLACE_AUTHOR', 'SECURITY_RESEARCHER');

-- CreateEnum
CREATE TYPE "CodeAuditCitationType" AS ENUM ('CODE_SMELL', 'BAD_MERGE_REQUEST', 'SECURITY_VULNERABILITY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'FLAGGED_SUSPICIOUS');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('INFO', 'WARNING', 'SUSPICIOUS', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SprintPayoutStatus" AS ENUM ('PROPOSED', 'APPROVED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentId" TEXT,
    "role" VARCHAR(50) NOT NULL DEFAULT 'DEVELOPER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publicKey" TEXT,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" "SquadHealthStatus" NOT NULL DEFAULT 'STABLE',
    "valuation" DECIMAL(14,2) NOT NULL DEFAULT 100000.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadRepository" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "owner" VARCHAR(120) NOT NULL,
    "repo" VARCHAR(120) NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "token" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "role" "SquadRole" NOT NULL,
    "allocation" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "SquadMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "squadId" TEXT,
    "type" "AccountType" NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" "TransactionType" NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "prevHash" VARCHAR(64) NOT NULL,
    "entryHash" VARCHAR(64) NOT NULL,
    "sequenceNumber" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "clientMilestoneId" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "storyPoints" INTEGER NOT NULL DEFAULT 1,
    "assignedToId" TEXT,
    "assignedById" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "sprintNumber" INTEGER,
    "gitPrUrl" TEXT,
    "gitCommitHash" VARCHAR(64),
    "lastCommitTimestamp" TIMESTAMP(3),
    "flaggedCompleteAt" TIMESTAMP(3),
    "pmVerifiedById" TEXT,
    "pmVerifiedAt" TIMESTAMP(3),
    "pmIsFlagPremature" BOOLEAN NOT NULL DEFAULT false,
    "pmPenaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "pmFeedback" TEXT,
    "ctoVerifiedById" TEXT,
    "ctoVerifiedAt" TIMESTAMP(3),
    "ctoQualityPassed" BOOLEAN,
    "ctoFineLevied" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "ctoCritique" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAuditEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fromStatus" "TaskStatus" NOT NULL,
    "toStatus" "TaskStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollProposal" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "labNumber" INTEGER NOT NULL,
    "sprintNumber" INTEGER,
    "totalProposed" DECIMAL(10,2) NOT NULL,
    "status" "PayrollProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "PayrollTier" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "justification" TEXT,

    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "category" "NoticeCategory" NOT NULL,
    "signature" TEXT NOT NULL,
    "status" "NoticeStatus" NOT NULL DEFAULT 'DISPATCHED',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgmentSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "borrowerSquadId" TEXT NOT NULL,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(4,2) NOT NULL DEFAULT 0.15,
    "interestAmount" DECIMAL(12,2) NOT NULL,
    "totalDue" DECIMAL(12,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvedById" TEXT,
    "ceoApproved" BOOLEAN NOT NULL DEFAULT false,
    "disbursedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "repaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquityStake" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "stakePercent" DECIMAL(4,2) NOT NULL DEFAULT 0.10,
    "investedAmount" DECIMAL(12,2) NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquityStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugBountyTarget" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "targetSquadId" TEXT NOT NULL,
    "clientMilestoneId" TEXT,
    "totalBountyPool" DECIMAL(12,2) NOT NULL,
    "remainingPool" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugBountyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "bountyTargetId" TEXT,
    "reportingUserId" TEXT NOT NULL,
    "reportingSquadId" TEXT NOT NULL,
    "targetSquadId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "reproductionSteps" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL,
    "bountyAmount" DECIMAL(10,2),
    "status" "BugReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedByCtoId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "sprintNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeAuditCitation" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "citedById" TEXT NOT NULL,
    "type" "CodeAuditCitationType" NOT NULL,
    "description" TEXT NOT NULL,
    "fineAmount" DECIMAL(10,2) NOT NULL DEFAULT 2000.00,
    "ctoCut" DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeAuditCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultancyBooking" (
    "id" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "clientSquadId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 4000.00,
    "consultantCut" DECIMAL(10,2) NOT NULL DEFAULT 2000.00,
    "meetingNotes" TEXT,
    "prLinks" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultancyBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "repositoryUrl" TEXT,
    "isCtoVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDelisted" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "weeklySquadPurchaseLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerSquadId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtoProviderCertification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationType" "CertificationType" NOT NULL,
    "qualityScore" INTEGER,
    "isPreapproved" BOOLEAN NOT NULL DEFAULT false,
    "portfolioUrl" VARCHAR(512),
    "applicationNotes" TEXT,
    "ctoReviewNotes" TEXT,
    "reviewedById" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtoProviderCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardDecision" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "category" "DecisionCategory" NOT NULL,
    "status" "BoardDecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "ceoApproved" BOOLEAN NOT NULL DEFAULT false,
    "ceoComment" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BoardDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionVote" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "vote" "DecisionVoteChoice" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChaosEvent" (
    "id" TEXT NOT NULL,
    "type" "ChaosEventType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "targetSquadId" TEXT,
    "targetUserId" TEXT,
    "penaltyAmount" DECIMAL(10,2),
    "triggeredById" TEXT NOT NULL,
    "penaltyDueAt" TIMESTAMP(3),
    "penaltyAppliedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaosEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyName" VARCHAR(255) NOT NULL,
    "contactName" VARCHAR(255),
    "contactEmail" VARCHAR(255) NOT NULL,
    "totalLifetimeValue" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "contractType" "ContractType" NOT NULL DEFAULT 'FIXED_BID',
    "totalValue" DECIMAL(14,2) NOT NULL,
    "escrowBalance" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "studioReservePercent" DECIMAL(4,2) NOT NULL DEFAULT 0.25,
    "squadSharePercent" DECIMAL(4,2) NOT NULL DEFAULT 0.65,
    "execOverheadPercent" DECIMAL(4,2) NOT NULL DEFAULT 0.10,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMilestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "assignedSquadId" TEXT,
    "milestoneName" VARCHAR(255) NOT NULL,
    "payoutAmount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "ctoApproved" BOOLEAN NOT NULL DEFAULT false,
    "clientAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "liveUrl" TEXT,
    "apiKey" VARCHAR(128) NOT NULL,
    "isClientProduct" BOOLEAN NOT NULL DEFAULT false,
    "clientContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTelemetryHourly" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recordedHour" TIMESTAMP(3) NOT NULL,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "errorCount5xx" INTEGER NOT NULL DEFAULT 0,
    "customEvents" JSONB,

    CONSTRAINT "ProductTelemetryHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "dpiScore" DECIMAL(5,2) NOT NULL,
    "storyPointsAssigned" INTEGER NOT NULL DEFAULT 0,
    "storyPointsCompleted" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveryRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "ctoQualityPassRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "prematureFlagsCount" INTEGER NOT NULL DEFAULT 0,
    "bugBountyContributions" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "pmhiScore" DECIMAL(5,2) NOT NULL,
    "velocityAccuracy" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "ctoAgreementRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "onTimeDeliveryRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "ctoOverrideCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PmPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadHealthSnapshot" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "bankBalance" DECIMAL(14,2) NOT NULL,
    "burnRate" DECIMAL(12,2) NOT NULL,
    "runwayPeriods" DECIMAL(6,2) NOT NULL,
    "healthStatus" "SquadHealthStatus" NOT NULL,
    "valuation" DECIMAL(14,2) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintPayout" (
    "id" TEXT NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "totalPool" DECIMAL(12,2) NOT NULL,
    "status" "SprintPayoutStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintPayoutItem" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "pmBonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "SprintPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STRING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveAuditLog" (
    "id" TEXT NOT NULL,
    "executiveId" TEXT NOT NULL,
    "executiveRole" "UserRole" NOT NULL,
    "actionType" VARCHAR(100) NOT NULL,
    "payloadSnapshot" JSONB NOT NULL,
    "riskSeverity" "RiskSeverity" NOT NULL DEFAULT 'INFO',
    "generatedReportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutiveAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'DEVELOPER',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "targetSquadId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_name_key" ON "Squad"("name");

-- CreateIndex
CREATE INDEX "SquadRepository_squadId_idx" ON "SquadRepository"("squadId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadRepository_squadId_owner_repo_key" ON "SquadRepository"("squadId", "owner", "repo");

-- CreateIndex
CREATE INDEX "SquadMembership_userId_idx" ON "SquadMembership"("userId");

-- CreateIndex
CREATE INDEX "SquadMembership_squadId_idx" ON "SquadMembership"("squadId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMembership_userId_squadId_key" ON "SquadMembership"("userId", "squadId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_ownerId_key" ON "Account"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_squadId_key" ON "Account"("squadId");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerTransaction_referenceType_idx" ON "LedgerTransaction"("referenceType");

-- CreateIndex
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_idx" ON "LedgerEntry"("accountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_sequenceNumber_idx" ON "LedgerEntry"("sequenceNumber");

-- CreateIndex
CREATE INDEX "Task_squadId_idx" ON "Task"("squadId");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_sprintNumber_idx" ON "Task"("sprintNumber");

-- CreateIndex
CREATE INDEX "TaskAuditEvent_taskId_idx" ON "TaskAuditEvent"("taskId");

-- CreateIndex
CREATE INDEX "PayrollProposal_squadId_idx" ON "PayrollProposal"("squadId");

-- CreateIndex
CREATE INDEX "PayrollProposal_status_idx" ON "PayrollProposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProposal_squadId_labNumber_key" ON "PayrollProposal"("squadId", "labNumber");

-- CreateIndex
CREATE INDEX "PayrollLineItem_proposalId_idx" ON "PayrollLineItem"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLineItem_proposalId_userId_key" ON "PayrollLineItem"("proposalId", "userId");

-- CreateIndex
CREATE INDEX "Notice_recipientId_idx" ON "Notice"("recipientId");

-- CreateIndex
CREATE INDEX "Notice_status_idx" ON "Notice"("status");

-- CreateIndex
CREATE INDEX "Loan_borrowerSquadId_idx" ON "Loan"("borrowerSquadId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "EquityStake_investorId_idx" ON "EquityStake"("investorId");

-- CreateIndex
CREATE INDEX "EquityStake_squadId_idx" ON "EquityStake"("squadId");

-- CreateIndex
CREATE INDEX "BugBountyTarget_targetSquadId_idx" ON "BugBountyTarget"("targetSquadId");

-- CreateIndex
CREATE INDEX "BugReport_targetSquadId_idx" ON "BugReport"("targetSquadId");

-- CreateIndex
CREATE INDEX "BugReport_reportingSquadId_idx" ON "BugReport"("reportingSquadId");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "CodeAuditCitation_squadId_idx" ON "CodeAuditCitation"("squadId");

-- CreateIndex
CREATE INDEX "ConsultancyBooking_consultantId_idx" ON "ConsultancyBooking"("consultantId");

-- CreateIndex
CREATE INDEX "ConsultancyBooking_clientSquadId_idx" ON "ConsultancyBooking"("clientSquadId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_authorId_idx" ON "MarketplaceListing"("authorId");

-- CreateIndex
CREATE INDEX "MarketplacePurchase_listingId_idx" ON "MarketplacePurchase"("listingId");

-- CreateIndex
CREATE INDEX "MarketplacePurchase_buyerSquadId_idx" ON "MarketplacePurchase"("buyerSquadId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePurchase_listingId_buyerSquadId_key" ON "MarketplacePurchase"("listingId", "buyerSquadId");

-- CreateIndex
CREATE INDEX "CtoProviderCertification_userId_idx" ON "CtoProviderCertification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CtoProviderCertification_userId_certificationType_key" ON "CtoProviderCertification"("userId", "certificationType");

-- CreateIndex
CREATE INDEX "BoardDecision_status_idx" ON "BoardDecision"("status");

-- CreateIndex
CREATE INDEX "DecisionVote_decisionId_idx" ON "DecisionVote"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionVote_decisionId_voterId_key" ON "DecisionVote"("decisionId", "voterId");

-- CreateIndex
CREATE INDEX "ChaosEvent_targetSquadId_idx" ON "ChaosEvent"("targetSquadId");

-- CreateIndex
CREATE INDEX "ChaosEvent_type_idx" ON "ChaosEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Client_contactEmail_key" ON "Client"("contactEmail");

-- CreateIndex
CREATE INDEX "ClientContract_clientId_idx" ON "ClientContract"("clientId");

-- CreateIndex
CREATE INDEX "ClientMilestone_contractId_idx" ON "ClientMilestone"("contractId");

-- CreateIndex
CREATE INDEX "ClientMilestone_assignedSquadId_idx" ON "ClientMilestone"("assignedSquadId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_apiKey_key" ON "Product"("apiKey");

-- CreateIndex
CREATE INDEX "Product_squadId_idx" ON "Product"("squadId");

-- CreateIndex
CREATE INDEX "ProductTelemetryHourly_productId_idx" ON "ProductTelemetryHourly"("productId");

-- CreateIndex
CREATE INDEX "ProductTelemetryHourly_recordedHour_idx" ON "ProductTelemetryHourly"("recordedHour");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTelemetryHourly_productId_recordedHour_key" ON "ProductTelemetryHourly"("productId", "recordedHour");

-- CreateIndex
CREATE INDEX "DeveloperPerformanceSnapshot_userId_idx" ON "DeveloperPerformanceSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperPerformanceSnapshot_userId_sprintNumber_key" ON "DeveloperPerformanceSnapshot"("userId", "sprintNumber");

-- CreateIndex
CREATE INDEX "PmPerformanceSnapshot_userId_idx" ON "PmPerformanceSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PmPerformanceSnapshot_userId_sprintNumber_key" ON "PmPerformanceSnapshot"("userId", "sprintNumber");

-- CreateIndex
CREATE INDEX "SquadHealthSnapshot_squadId_idx" ON "SquadHealthSnapshot"("squadId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadHealthSnapshot_squadId_sprintNumber_key" ON "SquadHealthSnapshot"("squadId", "sprintNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SprintPayout_sprintNumber_key" ON "SprintPayout"("sprintNumber");

-- CreateIndex
CREATE INDEX "SprintPayoutItem_squadId_idx" ON "SprintPayoutItem"("squadId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintPayoutItem_payoutId_squadId_key" ON "SprintPayoutItem"("payoutId", "squadId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "ExecutiveAuditLog_executiveRole_idx" ON "ExecutiveAuditLog"("executiveRole");

-- CreateIndex
CREATE INDEX "ExecutiveAuditLog_riskSeverity_idx" ON "ExecutiveAuditLog"("riskSeverity");

-- CreateIndex
CREATE INDEX "ExecutiveAuditLog_createdAt_idx" ON "ExecutiveAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- AddForeignKey
ALTER TABLE "SquadRepository" ADD CONSTRAINT "SquadRepository_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMembership" ADD CONSTRAINT "SquadMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMembership" ADD CONSTRAINT "SquadMembership_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientMilestoneId_fkey" FOREIGN KEY ("clientMilestoneId") REFERENCES "ClientMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_pmVerifiedById_fkey" FOREIGN KEY ("pmVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ctoVerifiedById_fkey" FOREIGN KEY ("ctoVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAuditEvent" ADD CONSTRAINT "TaskAuditEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAuditEvent" ADD CONSTRAINT "TaskAuditEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProposal" ADD CONSTRAINT "PayrollProposal_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProposal" ADD CONSTRAINT "PayrollProposal_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProposal" ADD CONSTRAINT "PayrollProposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "PayrollProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerSquadId_fkey" FOREIGN KEY ("borrowerSquadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityStake" ADD CONSTRAINT "EquityStake_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityStake" ADD CONSTRAINT "EquityStake_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugBountyTarget" ADD CONSTRAINT "BugBountyTarget_targetSquadId_fkey" FOREIGN KEY ("targetSquadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_bountyTargetId_fkey" FOREIGN KEY ("bountyTargetId") REFERENCES "BugBountyTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reportingUserId_fkey" FOREIGN KEY ("reportingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_reportingSquadId_fkey" FOREIGN KEY ("reportingSquadId") REFERENCES "Squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_targetSquadId_fkey" FOREIGN KEY ("targetSquadId") REFERENCES "Squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_verifiedByCtoId_fkey" FOREIGN KEY ("verifiedByCtoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeAuditCitation" ADD CONSTRAINT "CodeAuditCitation_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeAuditCitation" ADD CONSTRAINT "CodeAuditCitation_citedById_fkey" FOREIGN KEY ("citedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeAuditCitation" ADD CONSTRAINT "CodeAuditCitation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultancyBooking" ADD CONSTRAINT "ConsultancyBooking_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultancyBooking" ADD CONSTRAINT "ConsultancyBooking_clientSquadId_fkey" FOREIGN KEY ("clientSquadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultancyBooking" ADD CONSTRAINT "ConsultancyBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_buyerSquadId_fkey" FOREIGN KEY ("buyerSquadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtoProviderCertification" ADD CONSTRAINT "CtoProviderCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtoProviderCertification" ADD CONSTRAINT "CtoProviderCertification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardDecision" ADD CONSTRAINT "BoardDecision_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "BoardDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaosEvent" ADD CONSTRAINT "ChaosEvent_targetSquadId_fkey" FOREIGN KEY ("targetSquadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaosEvent" ADD CONSTRAINT "ChaosEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaosEvent" ADD CONSTRAINT "ChaosEvent_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMilestone" ADD CONSTRAINT "ClientMilestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ClientContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMilestone" ADD CONSTRAINT "ClientMilestone_assignedSquadId_fkey" FOREIGN KEY ("assignedSquadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientContractId_fkey" FOREIGN KEY ("clientContractId") REFERENCES "ClientContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTelemetryHourly" ADD CONSTRAINT "ProductTelemetryHourly_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperPerformanceSnapshot" ADD CONSTRAINT "DeveloperPerformanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmPerformanceSnapshot" ADD CONSTRAINT "PmPerformanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadHealthSnapshot" ADD CONSTRAINT "SquadHealthSnapshot_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintPayoutItem" ADD CONSTRAINT "SprintPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "SprintPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintPayoutItem" ADD CONSTRAINT "SprintPayoutItem_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutiveAuditLog" ADD CONSTRAINT "ExecutiveAuditLog_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
