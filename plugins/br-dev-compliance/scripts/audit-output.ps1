# Validate the native auditor's returned text before the caller uses it.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'result-validation.ps1')

function Publish-Check([string]$Message, $Response) {
    $output = [ordered]@{ hookEventName = 'PostToolUse'; additionalContext = $Message }
    if ($null -ne $Response) { $output.updatedToolOutput = $Response }
    Json @{ hookSpecificOutput = $output }
}

function Repair-EmptyAuditMetadata($Audit) {
    $scope = Field $Audit 'scope' $null
    if ($null -eq $scope) { return $false }
    $changed = $false
    foreach ($property in @($scope.PSObject.Properties)) {
        if ($property.Name -cin @('examined','excluded','limitations')) { continue }
        $value = $property.Value
        if ($null -eq $value -or ($value -is [Array] -and $value.Count -eq 0) -or
            ($value -is [string] -and $value.Trim() -in @('', 'n/a'))) {
            $scope.PSObject.Properties.Remove($property.Name)
            $changed = $true
        }
    }

    if ((Field $Audit 'mode' '') -cne 'plano' -or (Field $scope 'examined' @()) -cnotcontains 'plano') { return $changed }
    if ($Audit.sources -isnot [Array] -or $scope.limitations -isnot [Array]) { return $changed }
    Assert-Unique $Audit.sources 'id'
    $sources = [System.Collections.Generic.List[object]]::new()
    foreach ($source in $Audit.sources) {
        if ($source.location -cne 'repo:plano') {
            $sources.Add($source)
            continue
        }
        Test-ResultShape $source $script:resultSchema.properties.sources.items
        $citations = @($Audit.findings | ForEach-Object { $_.citations } | Where-Object { $_.source_id -ceq $source.id })
        if ($source.kind -cne 'metadados' -or $source.status -cne 'nao_consultada' -or $null -ne $source.accessed_at -or
            $source.attempts -ne 0 -or $source.fragments.Count -ne 0 -or $null -ne $source.version -or $citations.Count -ne 0) {
            throw 'result-virtual-plan-source'
        }
        if ($source.limitation -and $scope.limitations -cnotcontains $source.limitation) {
            $scope.limitations += $source.limitation
        }
        $changed = $true
    }
    $Audit.sources = $sources.ToArray()
    return $changed
}

function Read-ValidatedAudit([string]$Raw) {
    if ([Text.Encoding]::UTF8.GetByteCount($Raw) -gt 65536) { throw 'result-size' }
    $text = $Raw.Trim()
    $fence = [regex]::Match($text, '(?s)^\x60{3}(?:json)?\s*(\{.*\})\s*\x60{3}$')
    if ($fence.Success) { $text = $fence.Groups[1].Value }
    if (-not $text.StartsWith('{')) { throw 'result-format' }
    $audit = ConvertFrom-Json -InputObject $text
    $script:resultSchema = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../referencias/resultado.schema.json')) | ConvertFrom-Json
    $repaired = Repair-EmptyAuditMetadata $audit
    Assert-Result $audit
    if ($audit.decision -cne 'pendente') { throw 'result-decision' }
    [pscustomobject]@{ audit = $audit; repaired = $repaired -or $fence.Success }
}

try {
    $inputJson = [Console]::In.ReadToEnd()
    if ([Text.Encoding]::UTF8.GetByteCount($inputJson) -gt 1048576) { exit 0 }
    $event = ConvertFrom-Json -InputObject $inputJson
} catch { exit 0 }

if ((Field $event 'hook_event_name' '') -ceq 'SubagentStop') {
    if ((Field $event 'agent_type' '') -cne 'br-dev-compliance:auditor' -or
        (Field $event 'stop_hook_active' $null) -ne $false) { exit 0 }
    $raw = Field $event 'last_assistant_message' $null
    if ($raw -isnot [string] -or $raw.TrimStart() -cnotmatch '^(?:\{|\x60{3})') { exit 0 }
    try { $null = Read-ValidatedAudit $raw }
    catch {
        $code = $_.Exception.Message
        if ($code -cnotmatch '^(?:result-[a-z-]+|unsafe-relative-path)$') { $code = 'result-format' }
        Json @{ decision = 'block'; reason = ('BR Dev Compliance: corrija somente o JSON (' + $code + '). Mantenha achados, fontes, UTC e escopo. Em scope, use apenas examined, excluded e limitations. Retorne um objeto sem prosa. Sem novas leituras, consultas ou ferramentas.') }
    }
    exit 0
}

if ((Field $event 'hook_event_name' '') -cne 'PostToolUse' -or (Field $event 'tool_name' '') -cne 'Skill') { exit 0 }
if ((Field (Field $event 'tool_input' $null) 'skill' '') -cne 'br-dev-compliance:executar-auditoria') { exit 0 }
$response = Field $event 'tool_response' $null
$raw = Field $response 'result' $null
if ($raw -isnot [string] -or (Field $response 'status' '') -cne 'forked' -or
    (Field $response 'commandName' '') -cne 'br-dev-compliance:executar-auditoria' -or (Field $response 'success' $false) -ne $true) {
    Publish-Check 'BR Dev Compliance: validacao indisponivel. Auditoria pendente.' $null
    exit 0
}

try {
    $validated = Read-ValidatedAudit $raw
    $audit = $validated.audit
    $response.result = Json $audit
    if ($validated.repaired) {
        Publish-Check ('BR Dev Compliance: retorno normalizado e validado ' + $audit.audit_id + '.') $response
    } else {
        Publish-Check ('BR Dev Compliance: retorno validado ' + $audit.audit_id + '.') $response
    }
} catch {
    $response.result = 'BR Dev Compliance: retorno recusado pelo validador. Auditoria pendente.'
    Publish-Check $response.result $response
}
