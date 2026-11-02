# Pointfex ERP — Master Architecture Specification

> **Company:** Pointfex Venture Studio  
> **Slogan:** *"From an idea to a greater impact"*  
> **Course:** CSE474 — Software Development and Project Management, Southeast University  
> **Target Audience:** Engineering Team, System Architects, Course Faculty (CEO)  
> **Revision:** 2.0.0 (Production Blueprint)

---

## 1. System & Simulation Overview

Pointfex is a hybrid enterprise resource planning (ERP), project management, and venture studio simulation platform. The platform manages the entire lifecycle of software venture creation, dynamic product squads, real-client contracts, task tracking, and internal economics for 33 students and 1 course faculty acting as CEO.

### 1.1 Organizational Topology
* **CEO (Course Faculty / 1 User):** Supreme audit authority, sprint pool liquidity provider, chaos event trigger, and final veto on all 2-of-3 board decisions.
* **Team 0 (Executive Board / 3 Students):**
  * **CFO:** Runs the central bank, manages sprint payouts, evaluates loan requests, takes venture equity stakes, and collects penalty commissions.
  * **CTO:** Chief architect, code auditor, operator of the boilerplate marketplace and paid consultancy pool, quality gatekeeper, and bug bounty administrator.
  * **CPO / CHRO:** Chief People & Product Officer, orchestrates dynamic squads, verifies and approves weekly lab payroll, dispatches end-to-end encrypted notices, and fines unexcused absenteeism or slackers.
* **Product Squads (6 Squads, Dynamic Headcount):**
  * Elastic headcount (2–10+ members per squad; not rigidly fixed at 5).
  * Led by **1 Project Manager (PM)** with fractional or full developer assignments across Tiers A, B, C, and D.
  * Builds internal products and delivers real-client milestones.
* **Real-Client Engagements:**
  * Inbound client contracts with dynamic milestones, escrow funding, and automated revenue splits across the studio reserve, executing squad, and executive overhead.

### 1.2 Two-Tier Economic Model
The Pointfex economy operates on two isolated financial tiers governed by a double-entry, cryptographically chained ledger:
1. **Squad Treasury (`SQUAD_TREASURY`):** Capital bank accounts for squads (seeded with configurable default ৳100,000). Used for operational burn (৳10,000/lab payroll), marketplace purchases, paid consultancy bookings, and peer bug bounties.
2. **Individual Wallet (`PERSONAL_WALLET`):** Personal accounts for individual students and executives. Holds personal salaries, consultancy fees, marketplace royalties, executive commissions, and bonuses.

**Final Simulation Scoring Formula:**
$$\text{Simulation Score} = 50\% \times \text{Normalized Squad Valuation} + 50\% \times \text{Individual Wallet Balance}$$

---

## 2. Complete Technology Stack

| Layer | Technology | Version | Rationale & Responsibility |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS | `^10.3.0` | Modular architecture, strict Dependency Injection, native support for WebSockets, Microservices, and Guards. |
| **Language** | TypeScript | `^5.4.0` | Strict type safety, shared types between client and server, zero runtime casting surprises. |
| **Database** | PostgreSQL + TimescaleDB | `16-alpine` | ACID-compliant relational persistence for financial ledgers; TimescaleDB extension for high-frequency telemetry ingestion. |
| **ORM / Migration** | Prisma ORM | `^5.14.0` | Type-safe query building, declarative schema migrations, interactive transaction client with pessimistic locking capabilities. |
| **Caching & Queuing** | Redis + BullMQ | Redis `7-alpine` / BullMQ `^5.7.0` | In-memory distributed caching, rate-limiting counters, idempotency locks, and asynchronous background worker queues for audit reports and telemetry. |
| **Real-time Protocol** | Socket.io | `@nestjs/platform-socket.io ^10.3.0` | Bidirectional event streaming for CHRO notices, live task boards, CEO chaos alerts, and telemetry alarms. |
| **Authorization** | CASL | `@casl/ability ^6.7.0` | Declarative Attribute-Based Access Control (ABAC) and Role-Based Access Control (RBAC) preventing IDOR and privilege escalation. |
| **Authentication** | Passport-JWT + bcrypt | `passport-jwt ^4.0.1` / `bcrypt ^5.1.1` | Stateless signed JSON Web Tokens (15m access, 7d refresh) with salted password hashing (12 rounds). |
| **Validation** | Zod + nestjs-zod | `zod ^3.23.0` | Comprehensive schema parsing, runtime validation, and auto-generated Swagger DTOs. |
| **API Docs** | Swagger / OpenAPI | `@nestjs/swagger ^7.3.0` | Automated documentation generation and interactive API testing sandbox. |
| **Frontend / Web Console**| NestJS Static Assets SPA | `^10.3.0` | Zero-build, dependency-free responsive web portal served directly by the NestJS application for low-overhead deployment. |
| **Styling & UI** | Tailwind CSS + Shadcn/ui | Tailwind `^3.4.0` | Modern, accessible, responsive component library styled for data-dense executive and kanban dashboards. |
| **State & Data** | TanStack Query v5 | `@tanstack/react-query ^5.28.0` | Server-state caching, optimistic mutations for task boards, and automated refetching. |
| **Deployment** | Dokploy on Linux VPS | Latest Stable | Docker container orchestrator with Traefik auto-SSL, private container networking, and S3 backup integration. |
| **Offsite Backups** | Cloudflare R2 | S3-Compatible API | Zero-egress fee, encrypted offsite automated database snapshots every 6 hours with 30-day retention. |

---

## 3. NestJS Project Structure

The Pointfex backend adheres to an enterprise domain-driven modular structure:

```
pointfex-backend/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── common/
    │   ├── constants/
    │   │   ├── error-codes.constant.ts
    │   │   └── system-defaults.constant.ts
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   ├── public.decorator.ts
    │   │   ├── require-permissions.decorator.ts
    │   │   └── roles.decorator.ts
    │   ├── filters/
    │   │   ├── all-exceptions.filter.ts
    │   │   ├── http-exception.filter.ts
    │   │   └── prisma-client-exception.filter.ts
    │   ├── guards/
    │   │   ├── casl-ability.guard.ts
    │   │   ├── jwt-auth.guard.ts
    │   │   └── roles.guard.ts
    │   ├── interceptors/
    │   │   ├── audit-logger.interceptor.ts
    │   │   ├── idempotency.interceptor.ts
    │   │   └── transform-response.interceptor.ts
    │   └── pipes/
    │       └── zod-validation.pipe.ts
    └── modules/
        ├── auth/               # Authentication & token rotation
        ├── casl/               # ABAC ability factory
        ├── users/              # User profiles, public keys & tiers
        ├── squads/             # Squad metadata, dynamic memberships & balances
        ├── ledger/             # Double-entry ledger, HMAC chaining & pessimistic locks
        ├── tasks/              # Jira-like tasks, Kanban state machine & verification
        ├── payroll/            # Weekly lab payroll proposals & batch disbursements
        ├── notices/            # E2EE notices, cryptographic signatures & read receipts
        ├── loans/              # Emergency lending facility & auto-repayment
        ├── equity/             # VC equity stakes & automated dividend distributions
        ├── bounty/             # Bug bounty targets, peer reporting & verification
        ├── audit/              # Code audit citations & CTO quality verification
        ├── marketplace/        # Boilerplate asset listings & purchase limits
        ├── consultancy/        # Paid 15-minute peer architecture sessions
        ├── clients/            # Client CRM, variable SOWs, escrow & revenue recognition
        ├── products/           # Product registry, API keys & webhook endpoints
        ├── telemetry/          # High-frequency event ingestion & hourly rollups
        ├── health/             # DPI, PMHI & financial runway monitors
        ├── governance/         # 2-of-3 board decision voting & multi-sig
        ├── chaos/              # CEO live lab crises & lockdown triggers
        ├── reports/            # Automated executive PDF/Markdown report generator
        ├── settings/           # Dynamic SystemSettings key-value configuration
        └── dashboard/          # Aggregated CEO 360, CFO, CTO, CHRO & PM dashboards
```

---

## 4. Complete Prisma Schema

Save the following schema at `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// ENUMS
// ==========================================

enum UserRole {
  CEO
  CFO
  CTO
  CPO
  PM
  DEVELOPER
}

enum DeveloperTier {
  TIER_A
  TIER_B
  TIER_C
  TIER_D
}

enum SquadRole {
  PM
  DEVELOPER
}

enum AccountType {
  SQUAD_TREASURY
  PERSONAL_WALLET
  SYSTEM_RESERVE
  ESCROW
}

enum LedgerDirection {
  DEBIT
  CREDIT
}

enum TransactionType {
  SPRINT_PAYOUT
  TAX
  PAYROLL
  FINE
  CONSULTANCY
  BOUNTY
  LOAN_DISBURSEMENT
  LOAN_REPAYMENT
  EQUITY_INVESTMENT
  EQUITY_DIVIDEND
  SWAP_FEE
  MARKETPLACE_PURCHASE
  ESCROW_DEPOSIT
  ESCROW_RELEASE
  CHAOS_PENALTY
  CEO_BONUS
  CODE_AUDIT_FINE
  SLACKER_FINE
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  FLAGGED_COMPLETE
  PM_VERIFIED
  CTO_VERIFIED
  CLOSED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum PayrollProposalStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

enum PayrollTier {
  STAR_PERFORMER
  REGULAR
  UNDERPERFORMER
  SLACKER
}

enum LoanStatus {
  ACTIVE
  REPAID
  DEFAULTED
}

enum BugSeverity {
  CRITICAL
  MAJOR
  MINOR
}

enum BugReportStatus {
  SUBMITTED
  CTO_VERIFIED
  REJECTED
}

enum NoticeCategory {
  DISCIPLINARY
  APPOINTMENT
  ORGANIZATIONAL
  STUDIO_DIRECTIVE
}

enum NoticeStatus {
  DISPATCHED
  DELIVERED
  ACKNOWLEDGED
}

enum SquadHealthStatus {
  BULLISH
  STABLE
  BANKRUPT_RISK
}

enum BoardDecisionStatus {
  PROPOSED
  APPROVED
  REJECTED
  CEO_APPROVED
}

enum DecisionCategory {
  LOAN_APPROVAL
  SWAP_REQUEST
  POLICY_CHANGE
  EMERGENCY_ACTION
}

enum DecisionVoteChoice {
  APPROVE
  REJECT
}

enum ChaosEventType {
  SCOPE_CREEP
  LEAD_DEV_SICK_LEAVE
  SERVER_OUTAGE
  CUSTOM
}

enum ContractType {
  TIME_AND_MATERIALS
  FIXED_BID
  RETAINER
}

enum ContractStatus {
  DRAFT
  SIGNED
  ACTIVE
  COMPLETED
  DISPUTED
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  CTO_AUDIT
  CLIENT_REVIEW
  PAID
}

enum CertificationType {
  CONSULTANT
  MARKETPLACE_AUTHOR
  SECURITY_RESEARCHER
}

enum CodeAuditCitationType {
  CODE_SMELL
  BAD_MERGE_REQUEST
  SECURITY_VULNERABILITY
}

enum BookingStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  FLAGGED_SUSPICIOUS
}

enum RiskSeverity {
  INFO
  WARNING
  SUSPICIOUS
  CRITICAL
}

// ==========================================
// MODELS
// ==========================================

model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String
  fullName        String
  studentId       String?        @unique
  role            UserRole
  tier            DeveloperTier?
  isActive        Boolean        @default(true)
  publicKey       String?        @db.Text
  refreshTokenHash String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  // Relationships
  account                 Account?
  squadMemberships        SquadMembership[]
  assignedTasks           Task[]                     @relation("TaskAssignee")
  createdTasks            Task[]                     @relation("TaskCreator")
  pmVerifiedTasks         Task[]                     @relation("TaskPmVerifier")
  ctoVerifiedTasks        Task[]                     @relation("TaskCtoVerifier")
  taskAuditEvents         TaskAuditEvent[]
  payrollLineItems        PayrollLineItem[]
  submittedPayrolls       PayrollProposal[]          @relation("PayrollSubmitter")
  approvedPayrolls        PayrollProposal[]          @relation("PayrollApprover")
  sentNotices             Notice[]                   @relation("NoticeSender")
  receivedNotices         Notice[]                   @relation("NoticeRecipient")
  equityStakes            EquityStake[]
  authoredListings        MarketplaceListing[]       @relation("ListingAuthor")
  marketplacePurchases    MarketplacePurchase[]      @relation("BuyerUser")
  consultanciesAsExpert   ConsultancyBooking[]       @relation("ConsultantUser")
  consultanciesBooked     ConsultancyBooking[]       @relation("ConsultancyBooker")
  certifications          CtoProviderCertification[] @relation("CertifiedUser")
  reviewedCertifications  CtoProviderCertification[] @relation("CertReviewer")
  reportedBugs            BugReport[]                @relation("BugReporter")
  verifiedBugs            BugReport[]                @relation("BugCtoVerifier")
  codeCitationsIssued     CodeAuditCitation[]        @relation("CitationIssuer")
  proposedDecisions       BoardDecision[]            @relation("DecisionProposer")
  decisionVotes           DecisionVote[]
  targetedChaosEvents     ChaosEvent[]               @relation("ChaosTargetUser")
  triggeredChaosEvents    ChaosEvent[]               @relation("ChaosTriggerer")
  authorizedTransactions  LedgerTransaction[]        @relation("TxAuthorizer")
  executiveAuditLogs      ExecutiveAuditLog[]        @relation("AuditActor")
  dpiSnapshots            DeveloperPerformanceSnapshot[]
  pmhiSnapshots           PmPerformanceSnapshot[]
}

model Squad {
  id              String            @id @default(uuid())
  name            String            @unique
  description     String?
  isActive        Boolean           @default(true)
  healthStatus    SquadHealthStatus @default(STABLE)
  valuation       Decimal           @default(100000.00) @db.Decimal(14, 2)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  // Relationships
  account                 Account?
  memberships             SquadMembership[]
  tasks                   Task[]
  payrollProposals        PayrollProposal[]
  borrowedLoans           Loan[]                     @relation("BorrowerSquad")
  equityStakes            EquityStake[]
  marketplacePurchases    MarketplacePurchase[]
  consultanciesBooked     ConsultancyBooking[]
  bountyTargets           BugBountyTarget[]          @relation("TargetSquad")
  reportedBounties        BugReport[]                @relation("ReportingSquad")
  targetedBounties        BugReport[]                @relation("TargetedSquad")
  codeCitations           CodeAuditCitation[]
  targetedChaosEvents     ChaosEvent[]               @relation("ChaosTargetSquad")
  clientMilestones        ClientMilestone[]          @relation("AssignedSquad")
  products                Product[]
  healthSnapshots         SquadHealthSnapshot[]
}

model SquadMembership {
  id          String    @id @default(uuid())
  userId      String
  squadId     String
  role        SquadRole
  allocation  Decimal   @default(1.0) @db.Decimal(3, 2) // 0.00 to 1.00
  isPrimary   Boolean   @default(true)
  joinedAt    DateTime  @default(now())
  leftAt      DateTime?

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  squad       Squad     @relation(fields: [squadId], references: [id], onDelete: Cascade)

  @@unique([userId, squadId])
  @@index([userId])
  @@index([squadId])
}

model Account {
  id        String      @id @default(uuid())
  ownerId   String?     @unique // Populated if PERSONAL_WALLET
  squadId   String?     @unique // Populated if SQUAD_TREASURY
  type      AccountType
  balance   Decimal     @default(0.00) @db.Decimal(14, 2)
  currency  String      @default("BDT")
  isFrozen  Boolean     @default(false)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user          User?         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  squad         Squad?        @relation(fields: [squadId], references: [id], onDelete: Cascade)
  ledgerEntries LedgerEntry[]

  @@index([type])
}

model LedgerTransaction {
  id              String          @id @default(uuid())
  idempotencyKey  String          @unique
  referenceType   TransactionType
  referenceId     String?
  description     String?
  authorizedById  String
  createdAt       DateTime        @default(now())

  authorizedBy    User            @relation("TxAuthorizer", fields: [authorizedById], references: [id])
  entries         LedgerEntry[]

  @@index([referenceType])
  @@index([createdAt])
}

model LedgerEntry {
  id              String          @id @default(uuid())
  transactionId   String
  accountId       String
  direction       LedgerDirection
  amount          Decimal         @db.Decimal(14, 2)
  prevHash        String          @db.VarChar(64)
  entryHash       String          @db.VarChar(64)
  sequenceNumber  BigInt          @default(autoincrement())
  createdAt       DateTime        @default(now())

  transaction     LedgerTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  account         Account           @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([accountId])
  @@index([sequenceNumber])
}

model Task {
  id                    String        @id @default(uuid())
  squadId               String
  clientMilestoneId     String?
  title                 String        @db.VarChar(255)
  description           String?       @db.Text
  storyPoints           Int           @default(1)
  assignedToId          String?
  assignedById          String?
  status                TaskStatus    @default(BACKLOG)
  priority              TaskPriority  @default(MEDIUM)
  sprintNumber          Int?
  
  // Verification Artifacts & Timestamps
  gitPrUrl              String?       @db.Text
  gitCommitHash         String?       @db.VarChar(64)
  lastCommitTimestamp   DateTime?
  flaggedCompleteAt     DateTime?

  // PM Verification Gate
  pmVerifiedById        String?
  pmVerifiedAt          DateTime?
  pmIsFlagPremature     Boolean       @default(false)
  pmPenaltyPoints       Int           @default(0)
  pmFeedback            String?       @db.Text

  // CTO Technical Verification Gate
  ctoVerifiedById       String?
  ctoVerifiedAt         DateTime?
  ctoQualityPassed      Boolean?
  ctoFineLevied         Decimal       @default(0.00) @db.Decimal(10, 2)
  ctoCritique           String?       @db.Text

  dueDate               DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  squad                 Squad         @relation(fields: [squadId], references: [id], onDelete: Cascade)
  clientMilestone       ClientMilestone? @relation(fields: [clientMilestoneId], references: [id], onDelete: SetNull)
  assignedTo            User?         @relation("TaskAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  assignedBy            User?         @relation("TaskCreator", fields: [assignedById], references: [id], onDelete: SetNull)
  pmVerifiedBy          User?         @relation("TaskPmVerifier", fields: [pmVerifiedById], references: [id], onDelete: SetNull)
  ctoVerifiedBy         User?         @relation("TaskCtoVerifier", fields: [ctoVerifiedById], references: [id], onDelete: SetNull)
  
  auditEvents           TaskAuditEvent[]
  codeCitations         CodeAuditCitation[]

  @@index([squadId])
  @@index([assignedToId])
  @@index([status])
  @@index([sprintNumber])
}

model TaskAuditEvent {
  id          String     @id @default(uuid())
  taskId      String
  changedById String
  fromStatus  TaskStatus
  toStatus    TaskStatus
  comment     String?    @db.Text
  createdAt   DateTime   @default(now())

  task        Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  changedBy   User       @relation(fields: [changedById], references: [id], onDelete: Cascade)

  @@index([taskId])
}

model PayrollProposal {
  id              String                @id @default(uuid())
  squadId         String
  labNumber       Int
  sprintNumber    Int?
  totalProposed   Decimal               @db.Decimal(10, 2)
  status          PayrollProposalStatus @default(DRAFT)
  submittedById   String?
  approvedById    String?
  rejectedReason  String?               @db.Text
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  squad           Squad                 @relation(fields: [squadId], references: [id], onDelete: Cascade)
  submittedBy     User?                 @relation("PayrollSubmitter", fields: [submittedById], references: [id])
  approvedBy      User?                 @relation("PayrollApprover", fields: [approvedById], references: [id])
  lineItems       PayrollLineItem[]

  @@unique([squadId, labNumber])
  @@index([squadId])
  @@index([status])
}

model PayrollLineItem {
  id            String      @id @default(uuid())
  proposalId    String
  userId        String
  tier          PayrollTier
  amount        Decimal     @db.Decimal(10, 2)
  justification String?     @db.Text

  proposal      PayrollProposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  user          User            @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([proposalId, userId])
  @@index([proposalId])
}

model Notice {
  id                      String         @id @default(uuid())
  senderId                String
  recipientId             String
  title                   String         @db.VarChar(255)
  encryptedContent        String         @db.Text // Pre-encrypted client-side
  category                NoticeCategory
  signature               String         @db.Text // Ed25519 signature of sender
  status                  NoticeStatus   @default(DISPATCHED)
  acknowledgedAt          DateTime?
  acknowledgmentSignature String?        @db.Text
  createdAt               DateTime       @default(now())

  sender                  User           @relation("NoticeSender", fields: [senderId], references: [id])
  recipient               User           @relation("NoticeRecipient", fields: [recipientId], references: [id])

  @@index([recipientId])
  @@index([status])
}

model Loan {
  id              String      @id @default(uuid())
  borrowerSquadId String
  principalAmount Decimal     @db.Decimal(12, 2)
  interestRate    Decimal     @default(0.15) @db.Decimal(4, 2)
  interestAmount  Decimal     @db.Decimal(12, 2)
  totalDue        Decimal     @db.Decimal(12, 2)
  status          LoanStatus  @default(ACTIVE)
  approvedById    String?
  ceoApproved     Boolean     @default(false)
  disbursedAt     DateTime?
  dueDate         DateTime?
  repaidAt        DateTime?
  createdAt       DateTime    @default(now())

  borrowerSquad   Squad       @relation("BorrowerSquad", fields: [borrowerSquadId], references: [id], onDelete: Cascade)

  @@index([borrowerSquadId])
  @@index([status])
}

model EquityStake {
  id              String    @id @default(uuid())
  investorId      String    // CFO user ID
  squadId         String
  stakePercent    Decimal   @default(0.10) @db.Decimal(4, 2)
  investedAmount  Decimal   @db.Decimal(12, 2)
  sprintNumber    Int
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())

  investor        User      @relation(fields: [investorId], references: [id], onDelete: Cascade)
  squad           Squad     @relation(fields: [squadId], references: [id], onDelete: Cascade)

  @@index([investorId])
  @@index([squadId])
}

model BugBountyTarget {
  id                  String      @id @default(uuid())
  title               String      @db.VarChar(255)
  description         String?     @db.Text
  targetSquadId       String
  clientMilestoneId   String?
  totalBountyPool     Decimal     @db.Decimal(12, 2)
  remainingPool       Decimal     @db.Decimal(12, 2)
  createdById         String
  isActive            Boolean     @default(true)
  createdAt           DateTime    @default(now())

  targetSquad         Squad       @relation("TargetSquad", fields: [targetSquadId], references: [id], onDelete: Cascade)
  reports             BugReport[]

  @@index([targetSquadId])
}

model BugReport {
  id                String          @id @default(uuid())
  bountyTargetId    String?
  reportingUserId   String
  reportingSquadId  String
  targetSquadId     String
  title             String          @db.VarChar(255)
  description       String          @db.Text
  reproductionSteps String          @db.Text
  severity          BugSeverity
  bountyAmount      Decimal?        @db.Decimal(10, 2)
  status            BugReportStatus @default(SUBMITTED)
  verifiedByCtoId   String?
  verifiedAt        DateTime?
  rejectionReason   String?         @db.Text
  createdAt         DateTime        @default(now())

  target            BugBountyTarget? @relation(fields: [bountyTargetId], references: [id], onDelete: SetNull)
  reportingUser     User             @relation("BugReporter", fields: [reportingUserId], references: [id], onDelete: Restrict)
  reportingSquad    Squad            @relation("ReportingSquad", fields: [reportingSquadId], references: [id], onDelete: Restrict)
  targetSquad       Squad            @relation("TargetedSquad", fields: [targetSquadId], references: [id], onDelete: Restrict)
  verifiedByCto     User?            @relation("BugCtoVerifier", fields: [verifiedByCtoId], references: [id], onDelete: SetNull)

  @@index([targetSquadId])
  @@index([reportingSquadId])
  @@index([status])
}

model CodeAuditCitation {
  id            String                @id @default(uuid())
  squadId       String
  citedById     String                // CTO
  type          CodeAuditCitationType
  description   String                @db.Text
  fineAmount    Decimal               @default(2000.00) @db.Decimal(10, 2)
  ctoCut        Decimal               @default(1000.00) @db.Decimal(10, 2)
  taskId        String?
  createdAt     DateTime              @default(now())

  squad         Squad                 @relation(fields: [squadId], references: [id], onDelete: Cascade)
  citedBy       User                  @relation("CitationIssuer", fields: [citedById], references: [id], onDelete: Restrict)
  task          Task?                 @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([squadId])
}

model ConsultancyBooking {
  id            String        @id @default(uuid())
  consultantId  String        // CTO or certified consultant
  clientSquadId String
  bookedById    String        // PM or Dev
  fee           Decimal       @default(4000.00) @db.Decimal(10, 2)
  consultantCut Decimal       @default(2000.00) @db.Decimal(10, 2)
  meetingNotes  String?       @db.Text
  prLinks       String?       @db.Text
  status        BookingStatus @default(SCHEDULED)
  scheduledAt   DateTime
  completedAt   DateTime?
  createdAt     DateTime      @default(now())

  consultant    User          @relation("ConsultantUser", fields: [consultantId], references: [id], onDelete: Restrict)
  clientSquad   Squad         @relation(fields: [clientSquadId], references: [id], onDelete: Cascade)
  bookedBy      User          @relation("ConsultancyBooker", fields: [bookedById], references: [id], onDelete: Restrict)

  @@index([consultantId])
  @@index([clientSquadId])
}

model MarketplaceListing {
  id                      String    @id @default(uuid())
  authorId                String
  title                   String    @db.VarChar(255)
  description             String?   @db.Text
  price                   Decimal   @db.Decimal(10, 2)
  repositoryUrl           String?   @db.Text
  isCtoVerified           Boolean   @default(false)
  verifiedById            String?
  weeklySquadPurchaseLimit Int      @default(1)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  author                  User                  @relation("ListingAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  purchases               MarketplacePurchase[]

  @@index([authorId])
}

model MarketplacePurchase {
  id            String             @id @default(uuid())
  listingId     String
  buyerSquadId  String
  buyerUserId   String
  amount        Decimal            @db.Decimal(10, 2)
  createdAt     DateTime           @default(now())

  listing       MarketplaceListing @relation(fields: [listingId], references: [id], onDelete: Restrict)
  buyerSquad    Squad              @relation(fields: [buyerSquadId], references: [id], onDelete: Cascade)
  buyerUser     User               @relation("BuyerUser", fields: [buyerUserId], references: [id], onDelete: Restrict)

  @@index([listingId])
  @@index([buyerSquadId])
}

model CtoProviderCertification {
  id                String            @id @default(uuid())
  userId            String
  certificationType CertificationType
  qualityScore      Int               // 0 to 100
  isPreapproved     Boolean           @default(false)
  reviewedById      String?
  certifiedAt       DateTime          @default(now())
  expiresAt         DateTime?
  cooldownUntil     DateTime?

  user              User              @relation("CertifiedUser", fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy        User?             @relation("CertReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@unique([userId, certificationType])
  @@index([userId])
}

model BoardDecision {
  id              String              @id @default(uuid())
  title           String              @db.VarChar(255)
  description     String              @db.Text
  proposedById    String
  category        DecisionCategory
  status          BoardDecisionStatus @default(PROPOSED)
  ceoApproved     Boolean             @default(false)
  ceoComment      String?             @db.Text
  createdAt       DateTime            @default(now())
  resolvedAt      DateTime?

  proposedBy      User                @relation("DecisionProposer", fields: [proposedById], references: [id], onDelete: Restrict)
  votes           DecisionVote[]

  @@index([status])
}

model DecisionVote {
  id          String             @id @default(uuid())
  decisionId  String
  voterId     String
  vote        DecisionVoteChoice
  comment     String?            @db.Text
  createdAt   DateTime           @default(now())

  decision    BoardDecision      @relation(fields: [decisionId], references: [id], onDelete: Cascade)
  voter       User               @relation(fields: [voterId], references: [id], onDelete: Cascade)

  @@unique([decisionId, voterId])
  @@index([decisionId])
}

model ChaosEvent {
  id              String         @id @default(uuid())
  type            ChaosEventType
  title           String         @db.VarChar(255)
  description     String         @db.Text
  targetSquadId   String?
  targetUserId    String?
  penaltyAmount   Decimal?       @db.Decimal(10, 2)
  triggeredById   String
  resolvedAt      DateTime?
  resolution      String?        @db.Text
  createdAt       DateTime       @default(now())

  targetSquad     Squad?         @relation("ChaosTargetSquad", fields: [targetSquadId], references: [id], onDelete: SetNull)
  targetUser      User?          @relation("ChaosTargetUser", fields: [targetUserId], references: [id], onDelete: SetNull)
  triggeredBy     User           @relation("ChaosTriggerer", fields: [triggeredById], references: [id], onDelete: Restrict)

  @@index([targetSquadId])
  @@index([type])
}

model Client {
  id                  String           @id @default(uuid())
  companyName         String           @db.VarChar(255)
  contactName         String?          @db.VarChar(255)
  contactEmail        String           @unique @db.VarChar(255)
  totalLifetimeValue  Decimal          @default(0.00) @db.Decimal(14, 2)
  createdAt           DateTime         @default(now())

  contracts           ClientContract[]
}

model ClientContract {
  id                    String          @id @default(uuid())
  clientId              String
  title                 String          @db.VarChar(255)
  contractType          ContractType    @default(FIXED_BID)
  totalValue            Decimal         @db.Decimal(14, 2)
  escrowBalance         Decimal         @default(0.00) @db.Decimal(14, 2)
  studioReservePercent  Decimal         @default(0.25) @db.Decimal(4, 2)
  squadSharePercent     Decimal         @default(0.65) @db.Decimal(4, 2)
  execOverheadPercent   Decimal         @default(0.10) @db.Decimal(4, 2)
  status                ContractStatus  @default(DRAFT)
  createdAt             DateTime        @default(now())

  client                Client          @relation(fields: [clientId], references: [id], onDelete: Cascade)
  milestones            ClientMilestone[]
  products              Product[]

  @@index([clientId])
}

model ClientMilestone {
  id                String          @id @default(uuid())
  contractId        String
  assignedSquadId   String?
  milestoneName     String          @db.VarChar(255)
  payoutAmount      Decimal         @db.Decimal(14, 2)
  dueDate           DateTime?
  status            MilestoneStatus @default(PENDING)
  ctoApproved       Boolean         @default(false)
  clientAccepted    Boolean         @default(false)
  createdAt         DateTime        @default(now())

  contract          ClientContract  @relation(fields: [contractId], references: [id], onDelete: Cascade)
  assignedSquad     Squad?          @relation("AssignedSquad", fields: [assignedSquadId], references: [id], onDelete: SetNull)
  tasks             Task[]

  @@index([contractId])
  @@index([assignedSquadId])
}

model Product {
  id                String    @id @default(uuid())
  squadId           String
  name              String    @db.VarChar(255)
  liveUrl           String?   @db.Text
  apiKey            String    @unique @db.VarChar(128)
  isClientProduct   Boolean   @default(false)
  clientContractId  String?
  createdAt         DateTime  @default(now())

  squad             Squad     @relation(fields: [squadId], references: [id], onDelete: Cascade)
  clientContract    ClientContract? @relation(fields: [clientContractId], references: [id], onDelete: SetNull)
  telemetryHourly   ProductTelemetryHourly[]

  @@index([squadId])
}

model ProductTelemetryHourly {
  id              String   @id @default(uuid())
  productId       String
  recordedHour    DateTime
  uniqueVisitors  Int      @default(0)
  pageviews       Int      @default(0)
  apiRequests     Int      @default(0)
  activeUsers     Int      @default(0)
  avgLatencyMs    Decimal  @default(0.00) @db.Decimal(8, 2)
  errorCount5xx   Int      @default(0)
  customEvents    Json?

  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, recordedHour])
  @@index([productId])
  @@index([recordedHour])
}

model DeveloperPerformanceSnapshot {
  id                      String    @id @default(uuid())
  userId                  String
  sprintNumber            Int
  dpiScore                Decimal   @db.Decimal(5, 2)
  storyPointsAssigned     Int       @default(0)
  storyPointsCompleted    Int       @default(0)
  onTimeDeliveryRate      Decimal   @default(1.00) @db.Decimal(5, 2)
  ctoQualityPassRate      Decimal   @default(1.00) @db.Decimal(5, 2)
  prematureFlagsCount     Int       @default(0)
  bugBountyContributions  Int       @default(0)
  calculatedAt            DateTime  @default(now())

  user                    User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sprintNumber])
  @@index([userId])
}

model PmPerformanceSnapshot {
  id                String    @id @default(uuid())
  userId            String
  sprintNumber      Int
  pmhiScore         Decimal   @db.Decimal(5, 2)
  velocityAccuracy  Decimal   @db.Decimal(5, 2)
  ctoAgreementRate  Decimal   @db.Decimal(5, 2)
  onTimeDeliveryRate Decimal  @db.Decimal(5, 2)
  ctoOverrideCount  Int       @default(0)
  calculatedAt      DateTime  @default(now())

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sprintNumber])
  @@index([userId])
}

model SquadHealthSnapshot {
  id              String            @id @default(uuid())
  squadId         String
  sprintNumber    Int
  bankBalance     Decimal           @db.Decimal(14, 2)
  burnRate        Decimal           @db.Decimal(12, 2)
  runwayPeriods   Decimal           @db.Decimal(6, 2)
  healthStatus    SquadHealthStatus
  valuation       Decimal           @db.Decimal(14, 2)
  calculatedAt    DateTime          @default(now())

  squad           Squad             @relation(fields: [squadId], references: [id], onDelete: Cascade)

  @@unique([squadId, sprintNumber])
  @@index([squadId])
}

model SystemSetting {
  id        String   @id @default(uuid())
  key       String   @unique @db.VarChar(100)
  value     String   @db.Text
  type      String   @default("STRING") // STRING, NUMBER, JSON, BOOLEAN
  updatedAt DateTime @updatedAt
}

model ExecutiveAuditLog {
  id                  String       @id @default(uuid())
  executiveId         String
  executiveRole       UserRole
  actionType          String       @db.VarChar(100)
  payloadSnapshot     Json
  riskSeverity        RiskSeverity @default(INFO)
  generatedReportUrl  String?      @db.Text
  createdAt           DateTime     @default(now())

  executive           User         @relation("AuditActor", fields: [executiveId], references: [id], onDelete: Cascade)

  @@index([executiveRole])
  @@index([riskSeverity])
  @@index([createdAt])
}
```

---

## 5. Docker & Dokploy Deployment Configuration

### 5.1 Multi-Stage Production Dockerfile (`Dockerfile`)

```dockerfile
# ==========================================
# 1. Dependency Resolution
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# ==========================================
# 2. Production Build
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ==========================================
# 3. Production Runtime Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nestjs

EXPOSE 3000

# Apply migrations deterministically before launching HTTP daemon
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
```

### 5.2 Local & Single-Node Orchestration (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: pointfex-postgres
    restart: always
    environment:
      POSTGRES_DB: pointfex_db
      POSTGRES_USER: pointfex_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - pointfex-internal

  redis:
    image: redis:7-alpine
    container_name: pointfex-redis
    restart: always
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - pointfex-internal

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pointfex-api
    restart: always
    environment:
      DATABASE_URL: "postgresql://pointfex_admin:${DB_PASSWORD}@postgres:5432/pointfex_db?schema=public"
      REDIS_HOST: "redis"
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      LEDGER_SECRET_KEY: ${LEDGER_SECRET_KEY}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    networks:
      - pointfex-internal

volumes:
  pgdata:
  redisdata:

networks:
  pointfex-internal:
    driver: bridge
```

### 5.3 Dokploy Setup & Cloudflare R2 Backups
1. **Network Boundary:** Dokploy creates an isolated internal Docker bridge network. Databases and Redis are **never** bound to public ports `0.0.0.0`.
2. **Reverse Proxy:** Traefik terminates TLS automatically via Let's Encrypt certificates.
3. **Backup Schedule:** Configured in Dokploy Database Settings:
   * **Endpoint:** `https://<account_id>.r2.cloudflarestorage.com`
   * **Bucket:** `pointfex-db-backups`
   * **Cron Schedule:** `0 */6 * * *` (Every 6 hours)
   * **Retention:** `30` snapshots (Older snapshots automatically pruned).

---

## 6. Environment Variables (`.env.example`)

```bash
# ==========================================
# APPLICATION & RUNTIME
# ==========================================
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
CLIENT_URL=https://pointfex.yourdomain.com

# ==========================================
# DATABASE (POSTGRESQL & TIMESCALEDB)
# ==========================================
DB_PASSWORD=replace_with_super_secure_32_char_password
DATABASE_URL="postgresql://pointfex_admin:replace_with_super_secure_32_char_password@postgres:5432/pointfex_db?schema=public&connection_limit=25"

# ==========================================
# REDIS & BULLMQ
# ==========================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=replace_with_redis_password

# ==========================================
# CRYPTOGRAPHY & AUTHENTICATION
# ==========================================
JWT_SECRET=replace_with_jwt_secret_minimum_64_bytes
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
LEDGER_SECRET_KEY=replace_with_ledger_hmac_secret_sha256

# ==========================================
# CEO & SYSTEM SEEDING CREDENTIALS
# ==========================================
INITIAL_CEO_EMAIL=noor@seu.edu.bd
INITIAL_CEO_PASSWORD=replace_with_temporary_faculty_password
INITIAL_SYSTEM_RESERVE_FUND=5000000.00
```

---

## 7. API Conventions & Standards

All endpoints under `/api/v1` adhere to standard contract formats.

### 7.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-29T10:00:00.000Z",
    "requestId": "req_8f1b9a23",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

### 7.2 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "LEDGER_INSUFFICIENT_FUNDS",
    "message": "Account balance of ৳4,500.00 is insufficient for transfer of ৳10,000.00",
    "details": {
      "accountId": "acc_squad_4",
      "availableBalance": 4500.00,
      "requestedAmount": 10000.00
    }
  }
}
```

### 7.3 Financial Mutation Standards
All state-modifying endpoints involving financial balances, payroll, or loan disbursements **MUST** require the header:
```http
X-Idempotency-Key: <UUIDv4>
```
If an identical idempotency key is submitted within 24 hours, the server replays the initial response without executing a duplicate transaction.

---

## 8. Database Seeding Strategy

When running `prisma/seed.ts`, the database establishes genesis state:
1. **System Reserve Account (`SYSTEM_RESERVE`):** Initialized with ৳5,000,000.00 seed balance.
2. **Faculty User (`CEO`):** Course teacher account (`noor@seu.edu.bd`).
3. **Core System Settings:**
   * `SQUAD_INITIAL_BALANCE` = `100000`
   * `WEEKLY_LAB_BUDGET` = `10000`
   * `SPRINT_POOL_TOTAL` = `150000`
   * `CFO_TAX_RATE` = `0.05`
   * `LOAN_INTEREST_RATE` = `0.15`
   * `EQUITY_STAKE_PERCENT` = `0.10`
   * `EQUITY_DIVIDEND_RATE` = `0.10`
   * `CFO_PENALTY_INCENTIVE` = `0.20`
   * `CODE_AUDIT_FINE` = `2000`
   * `CTO_AUDIT_FINE_CUT` = `1000`
   * `CONSULTANCY_FEE` = `4000`
   * `CTO_CONSULTANCY_CUT_RATE` = `0.50`
   * `SLACKER_FINE` = `2000`
   * `CPO_SLACKER_CUT` = `500`
   * `SWAP_FEE` = `5000`
   * `CPO_SWAP_CUT_RATE` = `0.20`
   * `CRITICAL_BUG_BOUNTY` = `5000`
   * `MAJOR_BUG_BOUNTY` = `3000`
   * `BLIND_QA_PENALTY` = `15000`
   * `PM_LEADERSHIP_BONUS_RATE` = `0.10`
4. **Squad Seeding:** Squads 1 through 6 created with `SQUAD_TREASURY` accounts credited with ৳100,000 each via a genesis `SYSTEM_RESERVE` $\rightarrow$ `SQUAD_TREASURY` ledger transaction.

---

## 9. Cross-Module Dependency Graph

```mermaid
graph TD
    AUTH["AuthModule"] --> CASL["CaslModule"]
    CASL --> ALL["All Business Modules"]
    
    LEDGER["LedgerModule (Core Engine)"]
    SETTINGS["SettingsModule"]
    
    PAYROLL["PayrollModule"] --> LEDGER
    LOANS["LoansModule"] --> LEDGER
    EQUITY["EquityModule"] --> LEDGER
    BOUNTY["BountyModule"] --> LEDGER
    MARKET["MarketplaceModule"] --> LEDGER
    CONSULT["ConsultancyModule"] --> LEDGER
    CLIENTS["ClientsModule"] --> LEDGER
    CHAOS["ChaosModule"] --> LEDGER
    
    TASKS["TasksModule"] --> HEALTH["HealthModule (DPI / PMHI)"]
    TELEMETRY["TelemetryModule"] --> PRODUCTS["ProductsModule"]
    PRODUCTS --> SQUADS["SquadsModule (Valuation)"]
    
    GOVERNANCE["GovernanceModule"] --> LOANS
    GOVERNANCE["GovernanceModule"] --> CHRO["Notices/Swaps"]
    
    ALL --> AUDIT["AuditReportModule"]
    AUDIT --> DASHBOARD["DashboardModule (CEO 360)"]
```

---

## 10. Document Suite Navigation Index

This master document serves as the hub. For deep domain-specific rules, refer to the corresponding spec:

| Spec File | Module / Focus | Primary Target Role |
| :--- | :--- | :--- |
| **`security.md`** | Zero-trust authentication, CASL ABAC, HMAC ledger chaining, E2EE notices & anti-exploit rules. | Security Engineer / Backend Lead |
| **`cfo.md`** | Central bank, sprint payouts, 5% tax, loans, venture equity stakes & financial reports. | CFO / Financial Backend Eng |
| **`cto.md`** | Code audit citations, 2-tier task verification, provider certification gate, bug bounty arena & store. | CTO / Quality Assurance Lead |
| **`chro.md`** | Dynamic roster management, weekly lab payroll, E2EE notice dispatch, slacker fines & swaps. | CHRO (CPO) / Talent Operations |
| **`ceo.md`** | 360 single-screen command center, 2-of-3 governance voting, chaos console & override engine. | Course Faculty (CEO) / Fullstack Eng |
| **`pm.md`** | Jira-like Kanban task engine, premature flag detection & penalties, sprint velocity & PMHI. | Project Managers / Squad Leads |
| **`dev.md`** | Developer task workflow, commit linkage verification, bug hunting, personal wallet & DPI score. | Developers / Engineering Squads |
| **`other.md`** | Real-client milestone pipeline, product telemetry SDK, squad valuation & WebSocket event index. | Fullstack / Infrastructure Eng |
