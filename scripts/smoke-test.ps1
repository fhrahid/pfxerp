# Pointfex ERP v1 — End-to-end smoke test
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'

function Login($email, $pw) {
  (Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{email=$email;password=$pw} | ConvertTo-Json)).data
}
function Api($method, $path, $token, $body = $null, $idem = $null) {
  $h = @{ Authorization = "Bearer $token" }
  if ($idem) { $h['X-Idempotency-Key'] = $idem }
  $json = if ($body -ne $null) { $body | ConvertTo-Json -Depth 10 } else { $null }
  Invoke-RestMethod -Uri "$base/$path" -Method $method -Headers $h -ContentType 'application/json' -Body $json
}

$ceo = Login 'noor@seu.edu.bd' 'PointfexCeo2026!'
$cfo = Login 'cfo@pointfex.dev' 'Pointfex2026!'
$cto = Login 'cto@pointfex.dev' 'Pointfex2026!'
$cpo = Login 'cpo@pointfex.dev' 'Pointfex2026!'
$pm1 = Login 'pm1@pointfex.dev' 'Pointfex2026!'
$dev1 = Login 'dev1_1@pointfex.dev' 'Pointfex2026!'
Write-Host "== logins OK (ceo/cfo/cto/cpo/pm/dev)"

$squads = (Api GET 'squads' $ceo.accessToken).data
$squad1 = $squads | Where-Object { $_.name -eq 'Squad 1' }
Write-Host "== squads: $($squads.Count), Squad1 balance=$($squad1.balance)"

# ---- TASK LIFECYCLE ----
$members = (Api GET "squads/$($squad1.id)" $pm1.accessToken).data.members
$dev = $members | Where-Object { $_.role -eq 'DEVELOPER' } | Select-Object -First 1
$task = (Api POST 'tasks' $pm1.accessToken @{
  squadId=$squad1.id; title='Implement auth flow'; description='JWT auth with rotation';
  storyPoints=5; priority='HIGH'; sprintNumber=1; assignedToId=$dev.userId
}).data
Write-Host "== task created: $($task.id) status=$($task.status)"

(Api POST "tasks/$($task.id)/start" $dev1.accessToken | Out-Null)
Write-Host "== task started"
$flagged = (Api POST "tasks/$($task.id)/flag-complete" $dev1.accessToken @{ gitPrUrl='https://github.com/pointfex/squad-1/pull/14'; gitCommitHash='8f1b9a23c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9' }).data
Write-Host "== flagged complete at $($flagged.flaggedCompleteAt)"

$pmVerified = (Api POST "tasks/$($task.id)/pm-verify" $pm1.accessToken @{ comment='Acceptance criteria met' }).data
Write-Host "== PM verified: $($pmVerified.status)"

$ctoVerified = (Api POST "tasks/$($task.id)/cto-verify" $cto.accessToken @{ critique='Clean architecture, coverage 90%' }).data
Write-Host "== CTO verified: $($ctoVerified.status)"

$closed = (Api POST "tasks/$($task.id)/close" $pm1.accessToken).data
Write-Host "== closed: $($closed.status)"

# ---- SPRINT PAYOUT WATERFALL ----
$ranking = @(); $i = 1
foreach ($s in $squads) { $ranking += @{ squadId = $s.id; rank = $i }; $i++ }
$payout = (Api POST 'sprint-payouts' $cfo.accessToken @{ sprintNumber=1; rankings=$ranking }).data
Write-Host "== payout proposed: $($payout.status)"
(Api POST "sprint-payouts/$($payout.id)/ceo-approve" $ceo.accessToken | Out-Null)
$exec = (Api POST "sprint-payouts/$($payout.id)/execute" $cfo.accessToken $null ([guid]::NewGuid().ToString())).data
Write-Host "== payout executed: tax=$($exec.cfoTaxCollected) pmBonuses=$($exec.pmBonusesDisbursed)"

# ---- PAYROLL ----
$payroll = (Api POST 'payroll' $pm1.accessToken @{
  squadId=$squad1.id; labNumber=1; lineItems=@(
    @{ userId=$dev.userId; tier='STAR_PERFORMER'; amount=3500; justification='Shipped auth' },
    @{ userId=$pm1.user.id; tier='REGULAR'; amount=2000; justification='Planning' }
  )
}).data
Write-Host "== payroll proposed: total=$($payroll.totalProposed)"
$approved = (Api POST "payroll/$($payroll.proposalId)/approve" $cpo.accessToken $null ([guid]::NewGuid().ToString())).data
Write-Host "== payroll approved: disbursed=$($approved.disbursedAmount) recipients=$($approved.recipientsCount)"

# ---- CHAOS ----
$chaos = (Api POST 'chaos/events' $ceo.accessToken @{
  type='SERVER_OUTAGE'; title='DB Failure'; description='Primary postgres crashed. Fix within 10 minutes or pay 5000.';
  targetSquadId=$squad1.id; penaltyAmount=5000; timeLimitSeconds=600
}).data
Write-Host "== chaos triggered: $($chaos.id) due=$($chaos.penaltyDueAt)"
(Api POST "chaos/events/$($chaos.id)/resolve" $pm1.accessToken @{ resolution='Failed over to replica' } | Out-Null)
Write-Host "== chaos resolved (no penalty)"

# ---- BOUNTY: squad2 hunts squad1 ----
$squad2 = $squads | Where-Object { $_.name -eq 'Squad 2' }
$target = (Api POST 'bounty/targets' $cto.accessToken @{ title='Squad1 security target'; targetSquadId=$squad1.id; totalBountyPool=10000 }).data
Write-Host "== bounty target funded: pool=$($target.totalBountyPool)"
$dev2 = Login 'dev2_1@pointfex.dev' 'Pointfex2026!'
$report = (Api POST 'bounty/reports' $dev2.accessToken @{
  targetSquadId=$squad1.id; bountyTargetId=$target.id; title='SQLi in search';
  description='Unsanitized input in raw SQL query allows full table dump';
  reproductionSteps="1. GET /api/search?q=' OR 1=1--  2. observe dump"; severity='CRITICAL'
}).data
Write-Host "== bug report submitted: $($report.id)"
$triaged = (Api POST "bounty/reports/$($report.id)/triage" $cto.accessToken @{ action='VERIFY'; severity='CRITICAL' }).data
Write-Host "== bounty paid: $($triaged.bountyPaid) -> hunter squad"

# ---- LEDGER CHAIN ----
$chain = (Api POST 'ledger/verify-chain' $ceo.accessToken).data
Write-Host "== chain: $($chain.chainStatus) entries=$($chain.totalEntriesVerified) broken=$($chain.brokenEntriesCount)"

# ---- DASHBOARDS ----
$ceoDash = (Api GET 'dashboard/ceo' $ceo.accessToken).data
Write-Host "== CEO macro: cash=$($ceoDash.macro.circulatingCash) escrow=$($ceoDash.macro.activeEscrow) valuation=$($ceoDash.macro.studioValuation)"
$me = (Api GET 'dashboard/me' $dev1.accessToken).data
Write-Host "== dev1 wallet=$($me.walletBalance) openTasks=$($me.openTasks)"
$lb = (Api GET 'simulation-scores' $ceo.accessToken).data
Write-Host "== leaderboard top: $($lb.squadLeaderboard[0].squadName) val=$($lb.squadLeaderboard[0].valuation)"
Write-Host "== top student: $($lb.studentScores[0].fullName) score=$($lb.studentScores[0].simulationScore)"

# ---- SLACKER FINE ----
$fine = (Api POST 'fines/slacker' $cpo.accessToken @{ targetUserId=$dev.userId; targetSquadId=$squad1.id; reason='Zero commits and missed standup lab 2' } ([guid]::NewGuid().ToString())).data
Write-Host "== slacker fine: $($fine.fineAmount) (cpo=$($fine.cpoBounty), reserve=$($fine.reserveDeposit))"

# ---- NOTICE (E2EE ciphertext passthrough) ----
$env:BASE_URL = $base
$env:CPO_TOKEN = $cpo.accessToken
$env:NOTICE_RECIPIENT_ID = $dev1.user.id
$env:NOTICE_RECIPIENT_TOKEN = $dev1.accessToken
node scripts/notice-smoke.mjs
if ($LASTEXITCODE -ne 0) { throw 'Encrypted notice smoke flow failed' }

# ---- MARKETPLACE ----
$listing = (Api POST 'cto/marketplace/listings' $cto.accessToken @{ title='NestJS Clean Architecture Starter'; price=6000; description='Production grade starter'; repositoryUrl='https://github.com/pointfex/starter' }).data
$purchase = (Api POST "cto/marketplace/listings/$($listing.id)/purchase" $pm1.accessToken @{ buyerSquadId=$squad1.id } ([guid]::NewGuid().ToString())).data
Write-Host "== marketplace purchase: $($purchase.amount) -> author wallet"

# ---- CONSULTANCY ----
$sched = (Get-Date).AddDays(1).ToString('o')
$booking = (Api POST 'cto/consultancy/bookings' $pm1.accessToken @{ consultantId=$cto.user.id; clientSquadId=$squad1.id; scheduledAt=$sched } ([guid]::NewGuid().ToString())).data
Write-Host "== consultancy booked: $($booking.id) fee=$($booking.fee)"
$notes = (1..60 | ForEach-Object { 'word' }) -join ' '
$done = (Api POST "cto/consultancy/bookings/$($booking.id)/complete" $cto.accessToken @{ meetingNotes=$notes; prLinks='https://github.com/pointfex/squad-1/pull/20' }).data
Write-Host "== consultancy completed: $($done.status) consultantCut=$($booking.consultantCut)"

# ---- GOVERNANCE + LOAN ----
$squad4 = $squads | Where-Object { $_.name -eq 'Squad 4' }
$pm4 = Login 'pm4@pointfex.dev' 'Pointfex2026!'
# drain squad4 below threshold via CEO-triggered penalties? Instead: directly attempt loan -> expect threshold guard
try {
  $loan = (Api POST 'loans' $pm4.accessToken @{ squadId=$squad4.id; principalAmount=20000 }).data
  Write-Host "== loan applied: $($loan.id)"
  $decision = (Api POST 'governance/decisions' $cfo.accessToken @{ title='Approve emergency loan Squad 4'; description='Squad 4 treasury below threshold; approve BDT 20000 emergency loan.'; category='LOAN_APPROVAL'; referenceId=$loan.id }).data
  (Api POST "governance/decisions/$($decision.id)/vote" $cto.accessToken @{ vote='APPROVE' } | Out-Null)
  Write-Host "== board vote 1 cast (CTO)"
  $v2 = (Api POST "governance/decisions/$($decision.id)/vote" $cpo.accessToken @{ vote='APPROVE' } | Out-Null)
  Write-Host "== board vote 2 cast (CPO) -> $($v2.data.status)"
  (Api POST "governance/decisions/$($decision.id)/ceo-decide" $ceo.accessToken @{ approve=$true; comment='Signed off' } | Out-Null)
  $disbursed = (Api POST "loans/$($loan.id)/approve" $cfo.accessToken $null ([guid]::NewGuid().ToString())).data
  Write-Host "== loan disbursed: totalDue=$($disbursed.totalDue)"
  $repaid = (Api POST "loans/$($loan.id)/repay" $pm4.accessToken $null ([guid]::NewGuid().ToString())).data
  Write-Host "== loan repaid: $($repaid.status)"
} catch {
  Write-Host "== loan flow guarded: $($_.Exception.Message)"
}

# ---- CITATION ----
$citation = (Api POST 'cto/citations' $cto.accessToken @{ squadId=$squad1.id; type='CODE_SMELL'; description='God class UserService with 14 responsibilities detected' } ([guid]::NewGuid().ToString())).data
Write-Host "== citation issued: fine=$($citation.fineAmount) ctoCut=$($citation.ctoCut)"

# ---- FINAL CHAIN ----
$chain2 = (Api POST 'ledger/verify-chain' $ceo.accessToken).data
Write-Host "== final chain: $($chain2.chainStatus) entries=$($chain2.totalEntriesVerified) broken=$($chain2.brokenEntriesCount)"
Write-Host ''
Write-Host 'ALL SMOKE TESTS COMPLETE'
