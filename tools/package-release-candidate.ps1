param([Parameter(Mandatory = $true)][string]$CandidateRoot)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.test-output'))
$candidate = (Resolve-Path -LiteralPath $CandidateRoot).Path
if ([IO.Path]::GetDirectoryName($candidate) -ne $outputRoot) { throw 'Candidate must be an immediate child of .test-output' }
$inventoryPath = Join-Path $candidate 'inventory.json'
$inventory = Get-Content -LiteralPath $inventoryPath -Raw | ConvertFrom-Json
if ($inventory.status -ne 'local_candidate') { throw 'Expected a local candidate' }
$clients = @($inventory.packages.PSObject.Properties.Name | Sort-Object)
if (($clients -join ',') -ne 'antigravity,claude,codex') { throw 'Unexpected release clients' }
$destination = Join-Path $outputRoot ('release-1.0.0-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $destination | Out-Null
$archives = @()
foreach ($client in $clients) {
    $package = $inventory.packages.$client
    if ($package.version -ne '1.0.0') { throw 'Unexpected release version' }
    $archiveName = "br-dev-compliance-$client-1.0.0.zip"
    $archivePath = Join-Path $destination $archiveName
    [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $candidate $client), $archivePath)
    $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        $entries = @($archive.Entries | Where-Object { $_.Name -ne '' })
        if ($entries.Count -ne $package.files.Count) { throw "Unexpected entry count: $client" }
        $seen = @{}
        foreach ($entry in $entries) {
            $entryName = $entry.FullName.Replace('\', '/')
            if ($seen.ContainsKey($entryName)) { throw "Duplicate archive entry: $entryName" }
            $seen[$entryName] = $true
            $expected = @($package.files | Where-Object { $_.path -ceq $entryName })
            if ($expected.Count -ne 1) { throw "Unexpected archive entry: $entryName" }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $actualHash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
            finally { $stream.Dispose(); $sha.Dispose() }
            if ($actualHash -cne $expected[0].sha256) { throw "Archive bytes differ: $entryName" }
        }
    } finally { $archive.Dispose() }
    $archives += [ordered]@{ client = $client; file = $archiveName; sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant(); files = $package.files.Count }
}
Copy-Item -LiteralPath $inventoryPath -Destination (Join-Path $destination 'inventory.json')
$report = [ordered]@{ status = 'local_candidate'; version = '1.0.0'; license = 'Apache-2.0'; inventory_sha256 = (Get-FileHash -LiteralPath $inventoryPath -Algorithm SHA256).Hash.ToLowerInvariant(); archives = $archives }
$reportJson = ($report | ConvertTo-Json -Depth 8).Replace("`r`n", "`n") + "`n"
[IO.File]::WriteAllText((Join-Path $destination 'release.json'), $reportJson, [Text.UTF8Encoding]::new($false))
$archives | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ascii
Write-Output $destination
