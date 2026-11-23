# Adapt Codex lifecycle events to the local checkpoint. Trust in Codex opts in.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$output = '{}'

function Get-Field($Object, [string]$Name) {
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return $Object.$Name }
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ($utf8.GetByteCount($raw) -gt 1048576) { throw 'input-limit' }
    $event = ConvertFrom-Json $raw
    $name = Get-Field $event 'hook_event_name'
    $session = Get-Field $event 'session_id'
    $turn = Get-Field $event 'turn_id'
    $directory = Get-Field $event 'cwd'
    $permissionMode = Get-Field $event 'permission_mode'
    if ($name -notin @('UserPromptSubmit','Stop') -or (Get-Field $event 'stop_hook_active') -eq $true -or
        $session -isnot [string] -or -not $session -or $turn -isnot [string] -or -not $turn -or
        $directory -isnot [string] -or -not [IO.Directory]::Exists($directory)) {
        Write-Output $output
        exit 0
    }
    if ($permissionMode -eq 'plan') {
        if ($name -eq 'UserPromptSubmit') {
            $output = '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Ao fechar plano que envolve dados pessoais, terceiros ou dependencias, use BR Dev Compliance auditar se o usuario autorizou. Preserve as restricoes do modo plano."}}'
        }
        Write-Output $output
        exit 0
    }
    if ($permissionMode -eq 'dontAsk') {
        Write-Output $output
        exit 0
    }
    # Keep Codex checkpoint state separate from Claude session state.
    $request = ConvertTo-Json -Compress -InputObject @{
        hook_event_name=$name; cwd=$directory; session_id=('codex:' + $session)
    }
    $shared = Join-Path $PSScriptRoot '../shared/scripts/checkpoint.ps1'
    $env:CLAUDE_PLUGIN_OPTION_MODO = 'automatico'
    $powershell = (Get-Process -Id $PID).Path
    $child = $request | & $powershell -NoLogo -NoProfile -NonInteractive -File $shared
    if ($LASTEXITCODE -ne 0) { throw 'checkpoint-unavailable' }
    if ($child) {
        $result = ConvertFrom-Json ($child -join '')
        if (Get-Field $result 'systemMessage') {
            $output = '{"systemMessage":"BR Dev Compliance: checkpoint indisponivel. A revisao continua disponivel pela skill auditar."}'
        } elseif ($name -eq 'Stop' -and (Get-Field $result 'hookSpecificOutput')) {
            $output = '{"decision":"block","reason":"BR Dev Compliance: houve mudanca no repositorio ou a comparacao ficou incompleta. Se o escopo do turno permite, use a skill auditar em modo entrega e apresente a revisao. Se ja revisou a mesma entrega ou o usuario restringiu a auditoria, apenas mantenha o estado informado. Preserve a decisao do usuario."}'
        }
    } elseif ($name -eq 'UserPromptSubmit') {
        $output = '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Em tarefas com dados pessoais, terceiros ou dependencias, use BR Dev Compliance auditar ao fechar o plano antes das acoes dependentes, se autorizado. Perguntas e tarefas sem esse escopo seguem normalmente."}}'
    }
} catch {
    $output = '{"systemMessage":"BR Dev Compliance: checkpoint indisponivel. A revisao continua disponivel pela skill auditar."}'
}
Write-Output $output
