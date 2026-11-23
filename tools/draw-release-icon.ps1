# Rebuild the provisional release artwork on Windows using only geometric primitives.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Join-Path $PSScriptRoot '..'
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#A3E8BB'), 15)
try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#132C32'))
    $graphics.DrawLines($pen, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(82,70), [System.Drawing.Point]::new(36,128), [System.Drawing.Point]::new(82,186)
    ))
    $graphics.DrawLines($pen, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(174,70), [System.Drawing.Point]::new(220,128), [System.Drawing.Point]::new(174,186)
    ))
    $pen.Color = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')
    $graphics.DrawLines($pen, [System.Drawing.Point[]]@(
        [System.Drawing.Point]::new(87,130), [System.Drawing.Point]::new(116,157), [System.Drawing.Point]::new(166,98)
    ))
    foreach ($file in @('assets/release/claude-icon.png','plugins/br-dev-compliance/assets/icon.png','plugins/br-dev-compliance-codex/assets/icon.png')) {
        $bitmap.Save((Join-Path $root $file), [System.Drawing.Imaging.ImageFormat]::Png)
    }
} finally {
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
