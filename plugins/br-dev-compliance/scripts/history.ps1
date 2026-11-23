# Bundled Windows history adapter. JSON stdin; no model, network or target execution.
param(
    [switch]$CoverageOnly,
    [string]$RepositoryRoot,
    [int]$Offset = 0
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
$script:lock = $null
$script:timer = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'result-validation.ps1')
$script:jsonOptions = @{}
if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
    $script:jsonOptions.DateKind = 'String'
}
function Hash-Bytes([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Hash-Text([string]$Text) { return Hash-Bytes ([Text.Encoding]::UTF8.GetBytes($Text)) }
function Safe-Path([string]$Full) {
    $path = [IO.Path]::GetFullPath($Full)
    $prefix = $script:root.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'path-outside-root' }
    $cursor = $path
    while ($cursor.Length -ge $script:root.Length) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'linked-path-refused' }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
        if (-not $cursor) { break }
    }
    return $path
}
function Read-Json([string]$Path, [int]$Limit = 262144) {
    [void](Safe-Path $Path)
    if ((Get-Item -LiteralPath $Path -Force).Length -gt $Limit) { throw 'history-size-limit' }
    return [IO.File]::ReadAllText($Path) | ConvertFrom-Json @script:jsonOptions
}
function Assert-Keys($Object, $Keys) {
    if ((@($Object.PSObject.Properties.Name | Sort-Object) -join ',') -cne (@($Keys | Sort-Object) -join ',')) { throw 'invalid-history-fields' }
}
function Assert-Baseline($Baseline) {
    Assert-Keys $Baseline @('captured_at','snapshot')
    [void][DateTimeOffset]::Parse($Baseline.captured_at)
    $snapshot=$Baseline.snapshot
    Assert-Keys $snapshot @('root_binding','context_hash','plan_hash','policy_hash','files','inventory_hash')
    foreach ($key in @('root_binding','context_hash','policy_hash','inventory_hash')) { if ($snapshot.$key -cnotmatch '^[a-f0-9]{64}$') { throw 'invalid-baseline-hash' } }
    if ($null -ne $snapshot.plan_hash -and $snapshot.plan_hash -cnotmatch '^[a-f0-9]{64}$') { throw 'invalid-baseline-hash' }
    if ($snapshot.files -isnot [Array] -or $snapshot.files.Count -lt 1 -or $snapshot.files.Count -gt 20) { throw 'invalid-baseline-scope' }
    Assert-Unique $snapshot.files 'path'
    foreach ($file in $snapshot.files) {
        Assert-Keys $file @('path','hash')
        if ($file.path -cne 'plano') { [void](Safe-Relative $file.path) }
        if ($file.hash -cnotmatch '^([a-f0-9]{64}|missing)$') { throw 'invalid-baseline-hash' }
    }
}
function Test-UnconfirmedLocalSource($Audit, $Snapshot) {
    foreach ($source in $Audit.sources) {
        if ($source.status -cne 'consultada' -or -not $source.location.StartsWith('repo:')) { continue }
        $relative = $source.location.Substring(5)
        if ($relative -ceq 'plano' -or -not @($Snapshot.files | Where-Object { $_.path -ceq $relative -and $_.hash -cne 'missing' }).Count) { return $true }
    }
    return $false
}
function Git-Inventory {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = (Get-Command git.exe -CommandType Application | Select-Object -First 1).Source
    $info.WorkingDirectory = $script:root
    $info.Arguments = '--no-optional-locks -c core.fsmonitor=false -c core.untrackedCache=false ls-files --cached --others --exclude-standard -z'
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    foreach ($name in @('GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR')) { $info.EnvironmentVariables.Remove($name) }
    $process = New-Object Diagnostics.Process; $process.StartInfo = $info
    try {
        [void]$process.Start(); $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(2000)) { $process.Kill(); throw 'git-timeout' }
        $text=$stdout.GetAwaiter().GetResult(); [void]$stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'git-inventory-unavailable' }
        if ($text.Length -gt 262144) { throw 'inventory-limit' }
        # Keep the inventory stable across Windows PowerShell and PowerShell 7.
        $names = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($name in $text.Split([char]0)) {
            if ($name -and $name -ne '.br-dev-compliance' -and -not $name.StartsWith('.br-dev-compliance/', [StringComparison]::OrdinalIgnoreCase)) {
                [void]$names.Add($name)
            }
        }
        $paths = [string[]]@($names)
        [Array]::Sort($paths, [StringComparer]::Ordinal)
        if ($paths.Count -gt 1000) { throw 'inventory-limit' }
        return Hash-Text ($paths -join "`0")
    } finally { $process.Dispose() }
}
function Snapshot($Scope, [string]$ContextHash, $PlanHash) {
    if ($Scope -isnot [Array] -or $Scope.Count -lt 1 -or $Scope.Count -gt 20 -or @($Scope | Sort-Object -Unique).Count -ne $Scope.Count) { throw 'scope-limit' }
    $entries = @(); $bytes = 0L
    foreach ($relative in @($Scope | Sort-Object)) {
        if ($relative -ceq 'plano') {
            if (-not $PlanHash) { throw 'plan-required' }; $entries += [ordered]@{ path='plano'; hash=$PlanHash }; continue
        }
        [void](Safe-Relative $relative); $file = Safe-Path (Join-Path $script:root $relative)
        $hash = 'missing'
        if ([IO.File]::Exists($file)) {
            $length = (Get-Item -LiteralPath $file -Force).Length
            if (($bytes + $length) -gt 16777216 -or $script:timer.ElapsedMilliseconds -gt 8000) { throw 'snapshot-limit' }
            $content=[IO.File]::ReadAllBytes($file); $bytes += $content.Length; $hash=Hash-Bytes $content
        } elseif (Test-Path -LiteralPath $file) { throw 'scope-not-file' }
        $entries += [ordered]@{ path=$relative; hash=$hash }
    }
    return [ordered]@{ root_binding=$script:binding; context_hash=$ContextHash; plan_hash=$PlanHash; policy_hash=$script:policy; files=$entries; inventory_hash=(Git-Inventory) }
}
function Write-Atomic([string]$Path, $Value, [switch]$Text) {
    [void](Safe-Path $Path)
    $temporary=Safe-Path ($Path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp')
    try {
        $content=if($Text){[string]$Value}else{Json $Value}
        [IO.File]::WriteAllText($temporary,$content,(New-Object Text.UTF8Encoding($false)))
        [void](Safe-Path $Path)
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary,$Path,[NullString]::Value) } else { [IO.File]::Move($temporary,$Path) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}
function Load-Store {
    $markerPath=Safe-Path (Join-Path $script:storeDirectory 'projeto.json')
    $marker=$null; $records=@(); $decisions=@(); $invalid=@(); $legacy=0; $size=0L
    if ([IO.File]::Exists($markerPath)) {
        $marker=Read-Json $markerPath 4096
        Assert-Keys $marker @('schema','repo_id','root_binding')
        if ((Field $marker 'schema' 0) -ne 2 -or $marker.root_binding -cne $script:binding -or $marker.repo_id -cnotmatch '^repo-[a-f0-9]{32}$') { throw 'foreign-or-invalid-project' }
    }
    foreach ($kind in @('auditorias','decisoes')) {
        $directory=Safe-Path (Join-Path $script:storeDirectory $kind)
        if (-not [IO.Directory]::Exists($directory)) { continue }
        $files=@(Get-ChildItem -LiteralPath $directory -Force -File -Filter '*.json')
        if ($files.Count -gt 100) { throw 'history-count-limit' }
        foreach ($file in $files) {
            $prefix=if($kind -eq 'auditorias'){'aud-'}else{'dec-'}
            if (-not $file.Name.StartsWith($prefix)) { $legacy++; continue }
            try {
                $size += $file.Length; if ($size -gt 2097152) { throw 'history-size-limit' }
                $envelope=Read-Json $file.FullName
                Assert-Keys $envelope @('schema','id','repo_id','root_binding','payload','digest')
                if (-not $marker -or $envelope.schema -ne 2 -or $envelope.repo_id -cne $marker.repo_id -or $envelope.root_binding -cne $script:binding -or $envelope.id -cne $file.BaseName -or $envelope.id -cnotmatch ('^'+$prefix+'[a-f0-9]{32}$')) { throw 'invalid-envelope' }
                if ($envelope.digest -cne (Hash-Text (Json $envelope.payload))) { throw 'digest-mismatch' }
                if ($kind -eq 'auditorias') {
                    Assert-Keys $envelope.payload @('saved_at','audit','baseline','issues','reassess')
                    Assert-Baseline $envelope.payload.baseline
                    Assert-Result $envelope.payload.audit -Historical
                    if ($envelope.payload.audit.decision -cne 'pendente' -or $envelope.payload.baseline.snapshot.root_binding -cne $script:binding) { throw 'invalid-record' }
                    if (@($envelope.payload.issues).Count -ne $envelope.payload.audit.findings.Count) { throw 'invalid-issues' }
                    foreach ($link in $envelope.payload.issues) { Assert-Keys $link @('finding_id','issue_id') }
                    Assert-Unique $envelope.payload.issues 'finding_id'; Assert-Unique $envelope.payload.issues 'issue_id'
                    $records += $envelope
                } else {
                    Assert-Keys $envelope.payload @('saved_at','issue_id','decision','statement')
                    if ($envelope.payload.decision -cnotin @('continuar','corrigir','parar') -or -not $envelope.payload.statement -or $envelope.payload.issue_id -cnotmatch '^iss-[a-f0-9]{32}$') { throw 'invalid-decision' }
                    $decisions += $envelope
                }
            } catch { $invalid += $file.Name }
        }
    }
    return [pscustomobject]@{ marker=$marker; records=@($records | Sort-Object { $_.payload.saved_at }); decisions=@($decisions | Sort-Object { $_.payload.saved_at }); invalid=$invalid; legacy=$legacy }
}
function Get-Issues($Store) {
    $issues=@{}
    foreach ($record in $Store.records) {
        foreach ($link in $record.payload.issues) {
            $finding=@($record.payload.audit.findings | Where-Object { $_.id -ceq $link.finding_id })
            if ($finding.Count -ne 1 -or $link.issue_id -cnotmatch '^iss-[a-f0-9]{32}$') { throw 'invalid-issue-link' }
            $issues[$link.issue_id]=[ordered]@{ issue_id=$link.issue_id; check_id=$finding[0].check_id; summary=$finding[0].summary; technical_state='aberto'; record_id=$record.id; decision='pendente' }
        }
        foreach ($id in $record.payload.reassess) {
            if (-not $issues.ContainsKey($id)) { throw 'invalid-reassessment' }
            $issues[$id].technical_state='sem_indicio_na_reavaliacao'; $issues[$id].record_id=$record.id
        }
    }
    foreach ($decision in $Store.decisions) {
        if (-not $issues.ContainsKey($decision.payload.issue_id)) { throw 'orphan-decision' }
        $issues[$decision.payload.issue_id].decision=$decision.payload.decision
    }
    return ,$issues
}
function Current-Coverage($Store, $Request) {
    $views=@(); $issues=Get-Issues $Store
    foreach ($record in $Store.records) {
        $base=$record.payload.baseline.snapshot; $reasons=@()
        $comparison=[ordered]@{ inventory_names=$false; content_files_hashed=0; context=$false; virtual_plan=$false }
        $context=Field $Request 'context' $null; $plan=Field $Request 'plan' $null
        $contextHash=$base.context_hash; $planHash=$base.plan_hash
        if ($null -eq $context) { $reasons+='contexto_nao_confirmado' } else { $contextHash=Hash-Text ([string]$context) }
        if (@($base.files | Where-Object { $_.path -ceq 'plano' }).Count) {
            if ($null -eq $plan) { $reasons+='plano_nao_confirmado' } else { $planHash=Hash-Text ([string]$plan) }
        }
        try {
            $current=Snapshot @($base.files | ForEach-Object { $_.path }) $contextHash $planHash
            $comparison.inventory_names=$true
            $comparison.content_files_hashed=@($current.files | Where-Object { $_.path -cne 'plano' -and $_.hash -cne 'missing' }).Count
            $comparison.context=($null -ne $context)
            $comparison.virtual_plan=($null -ne $plan -and @($base.files | Where-Object { $_.path -ceq 'plano' }).Count -gt 0)
            foreach ($field in @('context_hash','plan_hash','policy_hash','inventory_hash')) { if ($current[$field] -cne $base.$field) { $reasons+=$field+'_alterado' } }
            if ((Json $current.files) -cne (Json $base.files)) { $reasons+='arquivos_alterados' }
        } catch { $reasons+='snapshot_nao_confirmado' }
        foreach ($source in $record.payload.audit.sources) {
            if ($source.status -ceq 'consultada' -and -not $source.location.StartsWith('repo:')) {
                if (([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($source.accessed_at)).TotalHours -gt 24) { $reasons+='fonte_vencida' }
                foreach ($update in @(Field $Request 'source_versions' @())) { if ($update.location -ceq $source.location -and $update.version -cne $source.version) { $reasons+='versao_fonte_alterada' } }
            }
        }
        if (Test-UnconfirmedLocalSource $record.payload.audit $base) { $reasons+='fonte_local_nao_confirmada' }
        if ($Store.invalid.Count) { $reasons+='historico_incompleto' }
        $freshness=if($reasons.Count){'revalidacao_pendente'}else{'correspondencia_tecnica_confirmada'}
        $views += [ordered]@{ record_id=$record.id; audit_id=$record.payload.audit.audit_id; generated_at=$record.payload.audit.generated_at; status=$record.payload.audit.status; freshness=$freshness; reasons=@($reasons | Sort-Object -Unique); comparison=$comparison; source_counts=[ordered]@{ consultada=@($record.payload.audit.sources | Where-Object { $_.status -ceq 'consultada' }).Count; indisponivel=@($record.payload.audit.sources | Where-Object { $_.status -ceq 'indisponivel' }).Count; nao_consultada=@($record.payload.audit.sources | Where-Object { $_.status -ceq 'nao_consultada' }).Count }; scope=@($base.files | ForEach-Object { $_.path }); coverage=@($record.payload.audit.coverage | ForEach-Object { [ordered]@{ check_id=$_.check_id; status=$_.status } }) }
        if ($reasons.Count) { foreach ($issue in $issues.Values) { if ($issue.record_id -ceq $record.id) { $issue.technical_state='revalidacao_pendente' } } }
    }
    $offset=Field $Request 'offset' 0
    if ($offset -isnot [ValueType] -or $offset -lt 0 -or $offset -gt 100 -or [int]$offset -ne $offset) { throw 'invalid-offset' }
    $visible=@($views | Select-Object -Skip $offset -First 10)
    $visibleIssues=@($issues.Values | Sort-Object { $_.issue_id } | Select-Object -First 20)
    foreach ($issue in $visibleIssues) { if ($issue.summary.Length -gt 180) { $issue.summary=$issue.summary.Substring(0,180)+'...' } }
    return [ordered]@{ schema=2; status=if($Store.invalid.Count){'integridade_nao_confirmada'}elseif(-not $views.Count){'sem_registro'}else{'historico_local_autodeclarado'}; records=$visible; total_records=$views.Count; offset=$offset; omitted_records=($views.Count-$visible.Count); issues=$visibleIssues; omitted_issues=($issues.Count-$visibleIssues.Count); invalid=$Store.invalid; legacy_untrusted=$Store.legacy; operation=[ordered]@{ helper_writes=$false; network=$false; host_writes_controlled=$false; inventory_policy='tracked_and_untracked_nonignored_names_including_plan_mode' }; legal_verification='not_performed' }
}
function Save-Summary($Store) {
    $file=Safe-Path (Join-Path $script:storeDirectory 'resumo.md'); $header='<!-- br-dev-compliance:derived:2 -->'
    if ([IO.File]::Exists($file)) {
        if ((Get-Item -LiteralPath $file).Length -gt 32768 -or -not [IO.File]::ReadAllText($file).StartsWith($header)) { return 'legacy-preserved' }
    }
    $lines=@($header,'# Historico de auditorias','','Visao derivada. Use /br-dev-compliance:cobertura para comparar ao estado atual.','Registros locais nao comprovam autenticidade, vigencia normativa ou conformidade.','')
    foreach ($record in $Store.records) { $lines += ('- '+$record.id+' | '+$record.payload.audit.generated_at+' | '+$record.payload.audit.status+' | '+(@($record.payload.audit.coverage | ForEach-Object { $_.check_id }) -join ', ')) }
    $issues=Get-Issues $Store
    foreach ($issue in $issues.Values) { $lines += ('- '+$issue.issue_id+' | '+$issue.check_id+' | '+$issue.technical_state+' | decisao: '+$issue.decision) }
    Write-Atomic $file ($lines -join "`n") -Text
    return 'updated'
}
function Append-Envelope([string]$Kind, $Payload, $Store) {
    $prefix=if($Kind -eq 'auditorias'){'aud-'}else{'dec-'}; $id=$prefix+[Guid]::NewGuid().ToString('N')
    $envelope=[ordered]@{ schema=2; id=$id; repo_id=$Store.marker.repo_id; root_binding=$script:binding; payload=$Payload; digest=(Hash-Text (Json $Payload)) }
    $directory=Safe-Path (Join-Path $script:storeDirectory $Kind); [void][IO.Directory]::CreateDirectory($directory)
    Write-Atomic (Join-Path $directory ($id+'.json')) $envelope
    return $id
}
try {
    if ($CoverageOnly) {
        $selectedRoot=if($RepositoryRoot){$RepositoryRoot}else{(Get-Location).ProviderPath}
        $request=[pscustomobject]@{action='coverage';root=$selectedRoot;offset=$Offset}
    } else {
        if ($PSBoundParameters.Count) { throw 'coverage-options-only' }
        $raw=[Console]::In.ReadToEnd(); if ([Text.Encoding]::UTF8.GetByteCount($raw) -gt 262144) { throw 'input-limit' }
        $request=$raw | ConvertFrom-Json @script:jsonOptions
    }
    $script:root=[IO.Path]::GetFullPath([string]$request.root).TrimEnd('\','/')
    if (-not [IO.Directory]::Exists($script:root)) { throw 'root-missing' }
    $script:binding=Hash-Text ($script:root.ToLowerInvariant())
    $script:storeDirectory=Safe-Path (Join-Path $script:root '.br-dev-compliance')
    $script:resultSchema=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../referencias/resultado.schema.json')) | ConvertFrom-Json
    $parts=@()
    foreach ($name in @('metodo.md','preparacao.md','verificacoes.md','fontes.md','resultado.schema.json','historico.md','historico.schema.json')) {
        $parts += Hash-Bytes ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot ('../referencias/'+$name))))
    }
    foreach ($name in @('history.ps1','result-validation.ps1','checkpoint.ps1','audit-output.ps1')) { $parts += Hash-Bytes ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $name))) }
    foreach ($relative in @('.claude-plugin/plugin.json','hooks/hooks.json','agents/auditor.md','skills/auditar/SKILL.md','skills/auditar-plano/SKILL.md','skills/auditar-entrega/SKILL.md','skills/cobertura/SKILL.md','skills/executar-auditoria/SKILL.md')) {
        $parts += Hash-Bytes ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot ('../'+$relative))))
    }
    # Machine identity stays local. Only the resulting policy hash enters a record.
    $machine = [string](Get-ItemPropertyValue -LiteralPath 'HKLM:/SOFTWARE/Microsoft/Cryptography' -Name MachineGuid)
    if ($machine -cnotmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') { throw 'machine-binding-unavailable' }
    $parts += Hash-Text ('history-machine-project:' + $script:binding + ':' + $machine.ToLowerInvariant())
    $script:policy=Hash-Text ($parts -join ':')
    if ($request.action -ceq 'capture') {
        if (-not (Field $request 'context' '') -or $request.context.Length -gt 4000) { throw 'context-required' }
        $planHash=$null; if ($null -ne (Field $request 'plan' $null)) { $planHash=Hash-Text ([string]$request.plan) }
        $snapshot=Snapshot $request.scope (Hash-Text ([string]$request.context)) $planHash
        Json ([ordered]@{ ok=$true; baseline=[ordered]@{ captured_at=[DateTimeOffset]::UtcNow.ToString('o'); snapshot=$snapshot }; written=$false }); exit 0
    }
    if ($request.action -ceq 'validate') { Assert-Result $request.audit; Json @{ok=$true;legal_verification='not_performed'}; exit 0 }
    if ($request.action -ceq 'coverage') { Json (Current-Coverage (Load-Store) $request); exit 0 }
    if ($request.action -cnotin @('record','decide')) { throw 'unknown-action' }
    # Validate before creating any history directory, marker, or lock.
    if ($request.action -ceq 'record') {
        Assert-Result $request.audit
        Assert-Baseline $request.baseline
        if ($request.audit.decision -cne 'pendente' -or $request.audit.status -ceq 'nao_executada') { throw 'record-not-an-audit' }
        if ([DateTimeOffset]::Parse($request.audit.generated_at) -gt [DateTimeOffset]::UtcNow.AddMinutes(5)) { throw 'future-audit' }
        if ([DateTimeOffset]::Parse($request.audit.generated_at) -lt [DateTimeOffset]::Parse($request.baseline.captured_at).AddSeconds(-2)) { throw 'audit-predates-baseline' }
        if (([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($request.baseline.captured_at)).TotalMinutes -gt 60 -or [DateTimeOffset]::Parse($request.baseline.captured_at) -gt [DateTimeOffset]::UtcNow.AddMinutes(1)) { throw 'baseline-expired' }
        $base=$request.baseline.snapshot
        if ((Json @($base.files | ForEach-Object { $_.path } | Sort-Object)) -cne (Json @($request.audit.scope.examined | Sort-Object))) { throw 'scope-baseline-mismatch' }
        $now=Snapshot @($base.files | ForEach-Object { $_.path }) $base.context_hash $base.plan_hash
        if ((Json $now) -cne (Json $base)) { throw 'snapshot-changed' }
        if (Test-UnconfirmedLocalSource $request.audit $now) { throw 'local-source-not-in-snapshot' }
    } else {
        if ((Field $request 'explicit' $false) -isnot [bool] -or (Field $request 'explicit' $false) -ne $true -or $request.decision -cnotin @('continuar','corrigir','parar') -or -not $request.statement -or $request.statement.Length -gt 1200) { throw 'explicit-decision-required' }
    }
    $store=Load-Store; if ($store.invalid.Count) { throw 'history-corrupt' }
    [void][IO.Directory]::CreateDirectory($script:storeDirectory)
    $lockPath=Safe-Path (Join-Path $script:storeDirectory 'historico.lock')
    $script:lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $store=Load-Store; if ($store.invalid.Count) { throw 'history-corrupt' }
    if (-not $store.marker) {
        $store.marker=[pscustomobject]@{ schema=2;repo_id=('repo-'+[Guid]::NewGuid().ToString('N'));root_binding=$script:binding }
        Write-Atomic (Join-Path $script:storeDirectory 'projeto.json') $store.marker
    }
    if (($store.records.Count+$store.decisions.Count) -ge 100) { throw 'history-count-limit' }
    $issues=Get-Issues $store
    if ($request.action -ceq 'record') {
        $links=@(); $used=@()
        foreach ($link in @(Field $request 'links' @())) {
            Assert-Keys $link @('finding_id','issue_id')
            if ($link.issue_id -cnotmatch '^iss-[a-f0-9]{32}$' -or @($request.audit.findings | Where-Object { $_.id -ceq $link.finding_id }).Count -ne 1) { throw 'invalid-issue-link' }
        }
        foreach ($finding in $request.audit.findings) {
            $map=@(@(Field $request 'links' @()) | Where-Object { $_.finding_id -ceq $finding.id })
            if ($map.Count -gt 1) { throw 'ambiguous-issue-link' }
            $issueId='iss-'+[Guid]::NewGuid().ToString('N')
            if ($map.Count) {
                $issueId=$map[0].issue_id
                if (-not $issues.ContainsKey($issueId) -or $issues[$issueId].check_id -cne $finding.check_id) { throw 'foreign-issue-link' }
                $prior=@($store.records | Where-Object { $_.id -ceq $issues[$issueId].record_id })[0]
                if (@($prior.payload.baseline.snapshot.files | Where-Object { $request.audit.scope.examined -cnotcontains $_.path }).Count) { throw 'issue-scope-mismatch' }
            }
            if ($used -contains $issueId) { throw 'duplicate-issue-link' }; $used+=$issueId
            $links += [ordered]@{ finding_id=$finding.id; issue_id=$issueId }
        }
        $reassess=@(Field $request 'reassess' @())
        if ($reassess.Count -gt 20 -or @($reassess | Sort-Object -Unique).Count -ne $reassess.Count) { throw 'invalid-reassessment' }
        foreach ($id in $reassess) {
            if ($id -cnotmatch '^iss-[a-f0-9]{32}$' -or -not $issues.ContainsKey($id) -or $used -contains $id) { throw 'invalid-reassessment' }
            $check=@($request.audit.coverage | Where-Object { $_.check_id -ceq $issues[$id].check_id -and $_.status -ceq 'sem_indicio' })
            $previous=@($store.records | Where-Object { $_.id -ceq $issues[$id].record_id })[0]
            $priorPaths=@($previous.payload.baseline.snapshot.files | ForEach-Object { $_.path })
            if ($check.Count -ne 1 -or @($priorPaths | Where-Object { $request.audit.scope.examined -cnotcontains $_ }).Count) { throw 'unconfirmed-correction' }
        }
        $id=Append-Envelope 'auditorias' ([ordered]@{ saved_at=[DateTimeOffset]::UtcNow.ToString('o');audit=$request.audit;baseline=$request.baseline;issues=$links;reassess=$reassess }) $store
    } else {
        if (-not $issues.ContainsKey($request.issue_id)) { throw 'unknown-issue' }
        $id=Append-Envelope 'decisoes' ([ordered]@{ saved_at=[DateTimeOffset]::UtcNow.ToString('o');issue_id=$request.issue_id;decision=$request.decision;statement=$request.decision }) $store
    }
    $summary='unavailable'; try { $summary=Save-Summary (Load-Store) } catch { $summary='failed-canonical-record-preserved' }
    Json ([ordered]@{ ok=$true;record_id=$id;summary=$summary;written=$true;legal_verification='not_performed' })
} catch {
    $code=$_.Exception.Message; if ($code -cnotmatch '^[a-z][a-z0-9-]+$') { $code='history-unavailable' }
    Json ([ordered]@{ok=$false;error=$code;error_line=$_.InvocationInfo.ScriptLineNumber;coverage_confirmed=$false;legal_verification='not_performed'})
    exit 1
} finally { if ($null -ne $script:lock) { $script:lock.Dispose() } }
