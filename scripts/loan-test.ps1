# Loan + Governance cycle: drain Squad 6 below threshold, then borrow -> 2-of-3 vote -> CEO -> disburse -> repay
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'
function Login($email, $pw) { (Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{email=$email;password=$pw} | ConvertTo-Json)).data }
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
$pm6 = Login 'pm6@pointfex.dev' 'Pointfex2026!'

$squads = (Api GET 'squads' $ceo.accessToken).data
$squad6 = $squads | Where-Object { $_.name -eq 'Squad 6' }
Write-Host "Squad 6 balance before: $($squad6.balance)"

# Drain: fund a bounty pool of 90000 from Squad 6 treasury (CTO-created target)
$target = (Api POST 'bounty/targets' $cto.accessToken @{ title='Squad6 hardening pool'; targetSquadId=$squad6.id; totalBountyPool=90000 }).data
$after = (Api GET "squads/$($squad6.id)" $ceo.accessToken).data
Write-Host "Squad 6 balance after drain: $($after.balance)"

# Loan application
$loan = (Api POST 'loans' $pm6.accessToken @{ squadId=$squad6.id; principalAmount=20000 }).data
Write-Host "loan applied: principal=$($loan.principalAmount) interest=$($loan.interestAmount) totalDue=$($loan.totalDue)"

# Governance: CFO proposes, CTO + CPO approve (2-of-3), CEO signs off
$decision = (Api POST 'governance/decisions' $cfo.accessToken @{ title='Emergency loan Squad 6'; description='Treasury below BDT 15000 threshold; approve BDT 20000 emergency loan at 15%.'; category='LOAN_APPROVAL'; referenceId=$loan.id }).data
Write-Host "decision proposed: $($decision.status)"
(Api POST "governance/decisions/$($decision.id)/vote" $cto.accessToken @{ vote='APPROVE'; comment='Risk acceptable' } | Out-Null)
$v2 = (Api POST "governance/decisions/$($decision.id)/vote" $cpo.accessToken @{ vote='APPROVE'; comment='Seconded' }).data
Write-Host "after 2 votes: $($v2.data.status)"
$final = (Api POST "governance/decisions/$($decision.id)/ceo-decide" $ceo.accessToken @{ approve=$true; comment='Faculty sign-off' }).data
Write-Host "after CEO: $($final.data.status) ceoApproved=$($final.data.ceoApproved)"

# Disburse + repay
$disbursed = (Api POST "loans/$($loan.id)/approve" $cfo.accessToken $null ([guid]::NewGuid().ToString())).data
Write-Host "disbursed at $($disbursed.disbursedAt) due $($disbursed.dueDate)"
$squad6AfterLoan = (Api GET "squads/$($squad6.id)" $ceo.accessToken).data
Write-Host "Squad 6 balance after disbursement: $($squad6AfterLoan.balance)"
$repaid = (Api POST "loans/$($loan.id)/repay" $pm6.accessToken $null ([guid]::NewGuid().ToString())).data
Write-Host "loan repaid: $($repaid.data.status)"

# CFO wallet should now hold the 15% interest
$cfoMe = (Api GET 'auth/me' $cfo.accessToken).data
Write-Host "CFO wallet (incl. 3000 interest + taxes): $($cfoMe.walletBalance)"

$chain = (Api POST 'ledger/verify-chain' $ceo.accessToken).data
Write-Host "chain: $($chain.chainStatus) entries=$($chain.totalEntriesVerified) broken=$($chain.brokenEntriesCount)"
Write-Host 'LOAN + GOVERNANCE CYCLE COMPLETE'
