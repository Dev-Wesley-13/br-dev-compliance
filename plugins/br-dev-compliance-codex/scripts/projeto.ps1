# Read-only coverage across explicitly selected Windows repositories.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$history = Join-Path $PSScriptRoot '../shared/scripts/history.ps1'
$powerShellExe = (Get-Process -Id $PID).Path

function Get-Property($Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return ,$property.Value }
}

function Assert-Fields($Object, [string[]]$Allowed) {
    if ($Object -isnot [pscustomobject] -or @($Object.PSObject.Properties.Name | Where-Object { $_ -cnotin $Allowed }).Count) {
        throw 'invalid-fields'
    }
}

function Assert-Id($Value) {
    if ($Value -isnot [string] -or $Value -cnotmatch '^[a-z][a-z0-9-]{0,47}$') { throw 'invalid-id' }
}

function Assert-LocalDirectory([string]$Path) {
    for ($cursor = $Path; $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        $item = Get-Item -LiteralPath $cursor -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'linked-or-invalid-root'
        }
    }
}

function Get-RepoRoot($Value) {
    # A simple drive path avoids UNC, device paths, and relative Git discovery.
    if ($Value -isnot [string] -or $Value -notmatch '^[a-z]:[\\/][^:]+$' -or $Value -match '[\x00-\x1f]' -or
        @($Value.Substring(3).Split([char[]]@('\','/')) | Where-Object { $_ -match '[. ]$' }).Count) { throw 'invalid-root' }
    $full = [IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    if ($full.Length -le 3) { throw 'invalid-root' }
    Assert-LocalDirectory $full
    Assert-LocalDirectory (Join-Path $full '.git')
    $git = (Get-Command git.exe -CommandType Application | Select-Object -First 1).Source
    $actual = Invoke-Local $git '--no-optional-locks -c core.fsmonitor=false rev-parse --show-toplevel' $full
    if ($actual.exit_code -ne 0 -or -not $actual.text.Trim() -or
        -not [IO.Path]::GetFullPath($actual.text.Trim()).Equals($full, [StringComparison]::OrdinalIgnoreCase)) { throw 'git-root-mismatch' }
    return $full
}

function Invoke-Local([string]$Executable, [string]$Arguments, [string]$Root, [string]$InputText) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Executable
    $info.Arguments = $Arguments
    $info.WorkingDirectory = $Root
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = $utf8
    foreach ($name in @('GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_CONFIG_COUNT','GIT_CONFIG_PARAMETERS')) {
        $info.EnvironmentVariables.Remove($name)
    }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $data = $utf8.GetBytes($InputText)
        try { $process.StandardInput.BaseStream.Write($data, 0, $data.Length) } finally { $process.StandardInput.Close() }
        if (-not $process.WaitForExit(15000)) { $process.Kill(); throw 'coverage-timeout' }
        [void]$stderr.GetAwaiter().GetResult()
        return @{ exit_code=$process.ExitCode; text=$stdout.GetAwaiter().GetResult() }
    } finally { $process.Dispose() }
}

function Get-Coverage($Request) {
    $inputText = ConvertTo-Json -InputObject $Request -Depth 8 -Compress
    $child = Invoke-Local $powerShellExe ('-NoLogo -NoProfile -NonInteractive -File "' + $history + '"') $Request.root $inputText
    $result = ConvertFrom-Json $child.text
    if ($child.exit_code -ne 0) {
        $reason = Get-Property $result 'error'
        if ($reason -isnot [string] -or $reason -cnotmatch '^[a-z][a-z0-9-]+$') { throw 'coverage-unavailable' }
        throw $reason
    }
    return $result
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ($utf8.GetByteCount($raw) -gt 65536) { throw 'input-limit' }
    $project = ConvertFrom-Json $raw
    Assert-Fields $project @('product_id','repositories','dependencies')
    $productId = Get-Property $project 'product_id'
    Assert-Id $productId
    $repositories = Get-Property $project 'repositories'
    if ($repositories -isnot [array] -or $repositories.Count -lt 1 -or $repositories.Count -gt 5) { throw 'repository-limit' }
    $requests = [ordered]@{}
    foreach ($repo in $repositories) {
        Assert-Fields $repo @('id','root','offset','context','plan','source_versions')
        $id = Get-Property $repo 'id'
        Assert-Id $id
        if ($requests.Contains($id)) { throw 'duplicate-repository-id' }
        $root = Get-RepoRoot (Get-Property $repo 'root')
        foreach ($other in $requests.Values) {
            if ($root.Equals($other.root, [StringComparison]::OrdinalIgnoreCase) -or
                $root.StartsWith($other.root + '\', [StringComparison]::OrdinalIgnoreCase) -or
                $other.root.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'overlapping-roots' }
        }
        $request = [ordered]@{ action='coverage'; root=$root }
        foreach ($key in @('offset','context','plan','source_versions')) {
            if ($null -ne $repo.PSObject.Properties[$key]) { $request[$key] = $repo.$key }
        }
        $requests[$id] = $request
    }
    $dependencies = @()
    if ($null -ne $project.PSObject.Properties['dependencies']) {
        if ($project.dependencies -isnot [array] -or $project.dependencies.Count -gt 20) { throw 'dependency-limit' }
        $edges = @{}
        foreach ($dependency in $project.dependencies) {
            Assert-Fields $dependency @('from','to')
            $from = Get-Property $dependency 'from'
            $to = Get-Property $dependency 'to'
            Assert-Id $from
            Assert-Id $to
            if ($from -ceq $to -or -not $requests.Contains($from) -or -not $requests.Contains($to)) { throw 'invalid-dependency' }
            $edge = $from + ':' + $to
            if ($edges.ContainsKey($edge)) { throw 'duplicate-dependency' }
            $edges[$edge] = $true
            $dependencies += [ordered]@{ from=$from; to=$to; status='analise_da_integracao_pendente' }
        }
    }
    $results = foreach ($id in $requests.Keys) {
        try { [ordered]@{ id=$id; coverage=(Get-Coverage $requests[$id]) } }
        catch {
            $reason = $_.Exception.Message
            if ($reason -cnotmatch '^[a-z][a-z0-9-]+$') { $reason = 'coverage-unavailable' }
            [ordered]@{ id=$id; coverage=[ordered]@{ status='indisponivel'; error=$reason } }
        }
    }
    ConvertTo-Json -Depth 18 -Compress -InputObject ([ordered]@{
        schema=1; product_id=$productId; repositories=@($results); dependencies=$dependencies
        written=$false; legal_verification='not_performed'
    })
} catch {
    $reason = $_.Exception.Message
    if ($reason -cnotmatch '^[a-z][a-z0-9-]+$') { $reason = 'invalid-project-request' }
    ConvertTo-Json -Compress -InputObject @{ ok=$false; error=$reason; written=$false }
    exit 1
}
