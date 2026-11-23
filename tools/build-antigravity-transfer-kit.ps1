param([Parameter(Mandatory = $true)][string]$ReleaseRoot)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releasePath = (Resolve-Path -LiteralPath $ReleaseRoot).Path
$release = Get-Content -LiteralPath (Join-Path $releasePath 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$archive = @($release.archives | Where-Object { $_.client -ceq 'antigravity' })
if ($archive.Count -ne 1 -or $release.version -cne '1.0.0' -or $archive[0].file -cne 'br-dev-compliance-antigravity-1.0.0.zip') { throw 'Expected the Antigravity 1.0.0 candidate.' }
$zipPath = Join-Path $releasePath $archive[0].file
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($zipHash -cne $archive[0].sha256) { throw 'Original ZIP differs from release metadata.' }
$inventoryHash = (Get-FileHash -LiteralPath (Join-Path $releasePath 'inventory.json') -Algorithm SHA256).Hash.ToLowerInvariant()
if ($inventoryHash -cne $release.inventory_sha256) { throw 'Original inventory differs from release metadata.' }
$output = Join-Path $projectRoot ('.test-output\agkit-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$workspace = Join-Path $output 'workspace'
$plugin = Join-Path $workspace '.agents\plugins\br-dev-compliance'
New-Item -ItemType Directory -Path $plugin -Force | Out-Null
foreach ($name in @($archive[0].file, 'inventory.json', 'release.json', 'SHA256SUMS.txt')) {
    Copy-Item -LiteralPath (Join-Path $releasePath $name) -Destination (Join-Path $workspace $name)
}
foreach ($name in @('LEIA-ME.md', 'PROMPT-DESCOBERTA.txt', 'verificar-kit.ps1', 'verificar-kit.mjs')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('antigravity-kit\' + $name)) -Destination (Join-Path $workspace $name)
}
# Pin this generated kit to the candidate selected by the maintainer. Do not
# mutate historical verifier templates or derive trust from remote kit metadata.
function Set-KitAnchor([string]$File, [string]$Pattern, [string]$Replacement) {
    $text = [IO.File]::ReadAllText($File)
    $matches = [regex]::Matches($text, $Pattern)
    if ($matches.Count -ne 1) { throw "Expected one verifier anchor: $Pattern" }
    $text = $text.Replace($matches[0].Value, $Replacement)
    [IO.File]::WriteAllText($File, $text, [Text.UTF8Encoding]::new($false))
}
Set-KitAnchor (Join-Path $workspace 'verificar-kit.mjs') "zip: '[a-f0-9]{64}'" "zip: '$zipHash'"
Set-KitAnchor (Join-Path $workspace 'verificar-kit.mjs') "inventory: '[a-f0-9]{64}'" "inventory: '$inventoryHash'"
Set-KitAnchor (Join-Path $workspace 'verificar-kit.ps1') "ExpectedZipSha256 = '[a-f0-9]{64}'" "ExpectedZipSha256 = '$zipHash'"
# Reject unexpected names before extraction. The verifier checks every extracted byte.
$inventory = Get-Content -LiteralPath (Join-Path $workspace 'inventory.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($zip.Entries | Where-Object { $_.Name -ne '' })
    $seen = @{}
    if ($entries.Count -ne 14) { throw 'Unexpected original ZIP entry count.' }
    foreach ($entry in $entries) {
        $name = $entry.FullName.Replace('\', '/')
        if ($name -match '(^/|(^|/)\.\.?(/|$)|:)' -or $seen.ContainsKey($name)) { throw 'Unsafe or duplicated ZIP entry.' }
        $seen[$name] = $true
        if (@($inventory.packages.antigravity.files | Where-Object { $_.path -ceq $name }).Count -ne 1) { throw 'Unexpected original ZIP entry.' }
    }
} finally { $zip.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $plugin)
$nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nodeCommand) {
    $verifierRuntime = 'node'
    $verificationText = & $nodeCommand.Source (Join-Path $workspace 'verificar-kit.mjs')
} else {
    $verifierRuntime = 'powershell'
    $verificationText = & pwsh.exe -NoLogo -NoProfile -NonInteractive -File (Join-Path $workspace 'verificar-kit.ps1')
}
if ($LASTEXITCODE -ne 0) { throw ('Transfer kit verification failed: ' + ($verificationText -join ' ')) }
$verification = ($verificationText -join "`n") | ConvertFrom-Json
if ($verification.status -cne 'package_verified' -or $verification.plugin_files -ne 14) { throw 'Unexpected verification result.' }
$kitName = 'br-dev-compliance-antigravity-1.0.0-kit-r4.zip'
$kitZip = Join-Path $output $kitName
[IO.Compression.ZipFile]::CreateFromDirectory($workspace, $kitZip)
$kitHash = (Get-FileHash -LiteralPath $kitZip -Algorithm SHA256).Hash.ToLowerInvariant()
$report = [ordered]@{ status = 'transfer_kit_prepared'; version = '1.0.0'; kit_revision = 4; file = $kitName; sha256 = $kitHash; original_plugin_zip_sha256 = $zipHash; inventory_sha256 = $inventoryHash; plugin_files = 14; verifier_runtime = $verifierRuntime; workspace_plugin_path = '.agents/plugins/br-dev-compliance'; native_discovery_verified = $false }
$reportJson = ($report | ConvertTo-Json -Depth 5).Replace("`r`n", "`n") + "`n"
[IO.File]::WriteAllText((Join-Path $output 'kit.json'), $reportJson, [Text.UTF8Encoding]::new($false))
Write-Output $output
