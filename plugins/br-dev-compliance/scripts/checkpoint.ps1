# P0 Windows: local change detection. This script never runs a model or target code.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$script:clock = [Diagnostics.Stopwatch]::StartNew()
$script:lock = $null

function Get-Digest([byte[]] $Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-TextDigest([string] $Text) {
    return Get-Digest ([Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-Field($Object, [string] $Name, $Default) {
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $Default
}

function Invoke-ReadOnlyGit([string] $Directory, [string] $Arguments, [switch] $Optional) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $script:git
    $info.WorkingDirectory = $Directory
    $info.Arguments = '--no-optional-locks -c core.fsmonitor=false -c core.untrackedCache=false ' + $Arguments
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    # A caller's Git routing variables must not redirect a local snapshot.
    foreach ($key in @('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR')) {
        $info.EnvironmentVariables.Remove($key)
    }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void] $process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(2000)) {
            $process.Kill()
            throw 'git-timeout'
        }
        $output = $stdout.GetAwaiter().GetResult()
        [void] $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            if ($Optional) { return $null }
            throw 'git-failed'
        }
        if ($output.Length -gt 2097152) { throw 'git-output-limit' }
        return $output
    } finally { $process.Dispose() }
}

function Test-ContainedPath([string] $Root, [string] $Path) {
    $prefix = $Root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $cursor = $full
    while ($cursor.Length -gt $Root.Length) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    return $true
}

function Get-Snapshot([string] $Root) {
    $listed = Invoke-ReadOnlyGit $Root 'ls-files --cached --others --exclude-standard -z'
    $head = Invoke-ReadOnlyGit $Root 'rev-parse --verify HEAD' -Optional
    if ($null -eq $head) { $head = 'unborn' }
    $paths = @($listed.Split([char]0) | Where-Object {
        $_ -and $_ -ne '.br-dev-compliance' -and -not $_.StartsWith('.br-dev-compliance/')
    } | Sort-Object -Unique)
    $parts = New-Object 'Collections.Generic.List[string]'
    $parts.Add($head.Trim())
    $bytes = 0L
    $examined = 0
    $skipped = 0
    foreach ($relative in $paths) {
        $file = [IO.Path]::GetFullPath((Join-Path $Root $relative))
        if (-not (Test-ContainedPath $Root $file)) {
            $parts.Add($relative + ':outside-or-link')
            $skipped++
            continue
        }
        if (-not [IO.File]::Exists($file)) {
            $parts.Add($relative + ':missing-or-submodule')
            if (Test-Path -LiteralPath $file -PathType Container) { $skipped++ }
            continue
        }
        $item = Get-Item -LiteralPath $file -Force
        if ($examined -ge 1000 -or ($bytes + $item.Length) -gt 16777216 -or $script:clock.ElapsedMilliseconds -gt 5000) {
            $parts.Add($relative + ':unread:' + $item.Length + ':' + $item.LastWriteTimeUtc.Ticks)
            $skipped++
            continue
        }
        # Hash raw bytes: no Git clean filters, textconv, external diff, or project scripts.
        $content = [IO.File]::ReadAllBytes($file)
        $bytes += $content.Length
        $examined++
        $parts.Add($relative + ':' + (Get-Digest $content))
    }
    return [pscustomobject]@{
        fingerprint = Get-TextDigest ($parts -join "`0")
        files = $examined
        skipped = $skipped
        bytes = $bytes
        complete = ($skipped -eq 0)
    }
}

function Save-State([string] $Root, [string] $Path, $State) {
    if (-not (Test-ContainedPath $Root $Path)) { throw 'unsafe-state-path' }
    # Keep the atomic replacement on the same volume without repeating the state digest.
    $temporary = Join-Path ([IO.Path]::GetDirectoryName($Path)) ([Guid]::NewGuid().ToString('N') + '.tmp')
    $utf8 = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($temporary, ($State | ConvertTo-Json -Depth 6 -Compress), $utf8)
    try {
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    }
}

function Send-Context([string] $Event, [string] $Message) {
    @{ hookSpecificOutput = @{ hookEventName = $Event; additionalContext = $Message } } |
        ConvertTo-Json -Depth 4 -Compress
}

try {
    $mode = $env:CLAUDE_PLUGIN_OPTION_MODO
    if (-not $mode -or $mode -notin @('automatico', 'manual', 'desligado')) {
        @{ systemMessage = 'BR Dev Compliance: configuracao de modo invalida; auditoria automatica nao executada. Configure o modo no gerenciador nativo.' } | ConvertTo-Json -Compress
        exit 0
    }
    if ($mode -ne 'automatico') { exit 0 }
    $raw = [Console]::In.ReadToEnd()
    if ($raw.Length -gt 1048576) { throw 'input-limit' }
    $event = $raw | ConvertFrom-Json
    $eventName = Get-Field $event 'hook_event_name' ''
    if ($eventName -notin @('UserPromptSubmit', 'Stop', 'PostToolUse')) { exit 0 }
    if ($eventName -eq 'Stop' -and (Get-Field $event 'stop_hook_active' $false) -eq $true) { exit 0 }
    if ($eventName -eq 'PostToolUse') {
        if ((Get-Field $event 'tool_name' '') -eq 'ExitPlanMode') {
            Send-Context $eventName 'BR Dev Compliance: antes das acoes dependentes do plano, use br-dev-compliance:auditar-plano se houver dados pessoais, terceiros ou dependencias. Passe o resumo do plano. Isso e um lembrete, nao uma auditoria concluida.'
        }
        exit 0
    }
    $directory = [string] (Get-Field $event 'cwd' '')
    $session = [string] (Get-Field $event 'session_id' '')
    if (-not $directory -or -not $session -or -not [IO.Directory]::Exists($directory)) { throw 'missing-context' }
    $script:git = (Get-Command git.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $rootOutput = Invoke-ReadOnlyGit $directory 'rev-parse --show-toplevel' -Optional
    if (-not $rootOutput) { exit 0 }
    $root = [IO.Path]::GetFullPath($rootOutput.Trim())
    $stateDirectory = Join-Path $root '.br-dev-compliance/runtime'
    if (-not (Test-ContainedPath $root $stateDirectory)) { throw 'unsafe-state-directory' }
    [void] [IO.Directory]::CreateDirectory($stateDirectory)
    $rootId = Get-TextDigest ($root.ToLowerInvariant())
    $key = Get-TextDigest ($rootId + ':' + $session)
    $statePath = Join-Path $stateDirectory ($key + '.json')
    $lockPath = Join-Path $stateDirectory ($key + '.lock')
    if (-not (Test-ContainedPath $root $lockPath) -or -not (Test-ContainedPath $root $statePath)) { throw 'unsafe-state-file' }
    $script:lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $state = $null
    if ([IO.File]::Exists($statePath)) {
        if ((Get-Item -LiteralPath $statePath).Length -gt 65536) { throw 'state-limit' }
        try { $state = [IO.File]::ReadAllText($statePath) | ConvertFrom-Json } catch { $state = $null }
    }
    if ((Get-Field $state 'schema' 0) -ne 1 -or (Get-Field $state 'root_id' '') -ne $rootId) { $state = $null }
    $snapshot = Get-Snapshot $root
    if ($eventName -eq 'UserPromptSubmit') {
        $record = [ordered]@{
            schema = 1; root_id = $rootId; baseline = $snapshot
            last_notification = Get-Field $state 'last_notification' ''
            audit_status = Get-Field $state 'audit_status' 'not_recorded'
            updated_at = [DateTime]::UtcNow.ToString('o')
        }
        Save-State $root $statePath $record
        exit 0
    }
    $baseline = Get-Field $state 'baseline' $null
    if ($null -eq $baseline) {
        # Installing mid-turn cannot establish what changed; request a bounded review.
        $baseline = [pscustomobject]@{ fingerprint = ''; complete = $false }
    }
    $same = (Get-Field $baseline 'fingerprint' '') -eq $snapshot.fingerprint
    if ($same -and $snapshot.complete -and (Get-Field $baseline 'complete' $false)) { exit 0 }
    if ((Get-Field $state 'last_notification' '') -eq $snapshot.fingerprint) { exit 0 }
    $record = [ordered]@{
        schema = 1; root_id = $rootId; baseline = $baseline
        last_notification = $snapshot.fingerprint; audit_status = 'pending'
        last_snapshot = $snapshot; updated_at = [DateTime]::UtcNow.ToString('o')
    }
    Save-State $root $statePath $record
    Send-Context 'Stop' 'BR Dev Compliance: houve mudanca no repositorio ou o checkpoint ficou incompleto. Use br-dev-compliance:auditar-entrega com o escopo desta tarefa e apresente o resultado neste turno. O lembrete nao comprova auditoria. Registre fontes, cobertura e pendencias; preserve a decisao do usuario. Nao execute scripts do projeto auditado.'
} catch {
    # Operational failure must not look like a successful audit or block the task.
    @{ systemMessage = 'BR Dev Compliance: checkpoint indisponivel; auditoria automatica nao confirmada. Use /br-dev-compliance:auditar para uma revisao explicita.' } |
        ConvertTo-Json -Compress
} finally {
    if ($null -ne $script:lock) { $script:lock.Dispose() }
}
exit 0
