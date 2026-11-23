param(
    [string]$KitRoot = $PSScriptRoot,
    [ValidatePattern('^[a-fA-F0-9]{64}$')]
    [string]$ExpectedZipSha256 = 'a8ece334ce8878f7d85863fd3ff569b8a52bc36baa826c1cc125dce45b0e4f8e'
)
$ErrorActionPreference = 'Stop'
try {
    $brdcKitRoot = (Resolve-Path -LiteralPath $KitRoot).Path.TrimEnd('\', '/')
    $pluginPath = Join-Path $brdcKitRoot '.agents\plugins\br-dev-compliance'
    if (Test-Path -LiteralPath (Join-Path $brdcKitRoot '.agents\skills\br-dev-compliance-auditar')) {
        throw 'Previous pilot skill found in this workspace; use a separate fresh folder.'
    }
    foreach ($name in @('inventory.json', 'release.json', 'SHA256SUMS.txt', 'br-dev-compliance-antigravity-1.0.0.zip')) {
        $item = Get-Item -LiteralPath (Join-Path $brdcKitRoot $name)
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Expected a regular kit file: $name" }
    }
    $release = Get-Content -LiteralPath (Join-Path $brdcKitRoot 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $inventory = Get-Content -LiteralPath (Join-Path $brdcKitRoot 'inventory.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($release.status -cne 'local_candidate' -or $release.version -cne '1.0.0' -or $release.license -cne 'Apache-2.0') { throw 'Unexpected release metadata.' }
    $inventoryHash = (Get-FileHash -LiteralPath (Join-Path $brdcKitRoot 'inventory.json') -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($inventoryHash -cne $release.inventory_sha256) { throw 'Inventory hash differs from release.json.' }
    $package = $inventory.packages.antigravity
    if ($inventory.status -cne 'local_candidate' -or $package.version -cne '1.0.0' -or $package.files.Count -ne 14) { throw 'Expected the 14-file Antigravity 1.0.0 package.' }
    $archive = @($release.archives | Where-Object { $_.client -ceq 'antigravity' })
    $expectedHash = $ExpectedZipSha256.ToLowerInvariant()
    if ($archive.Count -ne 1 -or $archive[0].file -cne 'br-dev-compliance-antigravity-1.0.0.zip' -or $archive[0].sha256 -cne $expectedHash -or $archive[0].files -ne 14) { throw 'Release metadata differs from the expected Antigravity ZIP.' }
    $zipHash = (Get-FileHash -LiteralPath (Join-Path $brdcKitRoot $archive[0].file) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($zipHash -cne $expectedHash) { throw 'ZIP hash differs from the expected maintainer hash.' }
    $checksumLines = @(Get-Content -LiteralPath (Join-Path $brdcKitRoot 'SHA256SUMS.txt') -Encoding UTF8)
    if ($checksumLines -cnotcontains ($expectedHash + '  ' + $archive[0].file)) { throw 'Expected ZIP checksum is missing from SHA256SUMS.txt.' }
    $expected = [System.Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach ($entry in $package.files) {
        if ($entry.path -match '(^/|(^|/)\.\.?(/|$)|:|\\)' -or $expected.ContainsKey($entry.path)) { throw 'Unsafe or duplicated inventory path.' }
        $expected.Add($entry.path, $entry.sha256)
    }
    function Get-BrdcKitFiles([string]$Directory) {
        $directoryItem = Get-Item -LiteralPath $Directory -Force
        if ($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Links are not accepted in the plugin payload.' }
        foreach ($child in Get-ChildItem -LiteralPath $Directory -Force) {
            if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Links are not accepted in the plugin payload.' }
            if ($child.PSIsContainer) { Get-BrdcKitFiles $child.FullName } else { $child }
        }
    }
    $actualFiles = @(Get-BrdcKitFiles $pluginPath)
    if ($actualFiles.Count -ne $expected.Count) { throw 'Extracted plugin file count differs from inventory.' }
    foreach ($file in $actualFiles) {
        $relative = $file.FullName.Substring($pluginPath.Length + 1).Replace('\', '/')
        if (-not $expected.ContainsKey($relative)) { throw "Unexpected plugin file: $relative" }
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -cne $expected[$relative]) { throw "Plugin hash differs from inventory: $relative" }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $pluginPath 'plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -cne 'br-dev-compliance' -or $manifest.version -cne '1.0.0' -or $manifest.license -cne 'Apache-2.0') { throw 'Unexpected native plugin manifest.' }
    $agyCommand = Get-Command agy -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $defaultAgy = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe' } else { $null }
    [ordered]@{
        status = 'package_verified'; version = $manifest.version; plugin_files = $actualFiles.Count
        zip_sha256 = $zipHash; inventory_sha256 = $inventoryHash
        plugin_location = '.agents/plugins/br-dev-compliance'; native_discovery_verified = $false
        agy_on_path = [bool]$agyCommand; agy_path = if ($agyCommand) { $agyCommand.Source } else { $null }
        agy_default_binary_exists = if ($defaultAgy) { Test-Path -LiteralPath $defaultAgy -PathType Leaf } else { $null }
        agy_cli_executed = $false; files_written_by_script = 0
        note = 'Package integrity only. Check native plugin/skill/agent discovery in the client. Missing agy does not block this Desktop/IDE check.'
    } | ConvertTo-Json -Depth 5
} catch {
    [ordered]@{ status = 'blocked'; error = $_.Exception.Message; files_written_by_script = 0 } | ConvertTo-Json -Compress
    exit 1
}
