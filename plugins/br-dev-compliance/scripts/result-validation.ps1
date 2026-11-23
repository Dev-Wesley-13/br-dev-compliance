# Fixed result.schema.json subset. No project code, network, or external modules.
function Field($Object, [string]$Name, $Default) {
    if ($null -ne $Object -and $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $Default
}
function Json($Value) { return ConvertTo-Json -InputObject $Value -Depth 80 -Compress }
function Safe-Relative([string]$Relative) {
    if (-not $Relative -or $Relative.Length -gt 300 -or $Relative.Contains('\') -or $Relative -match '[:\x00-\x1f]' -or $Relative.StartsWith('/')) { throw 'unsafe-relative-path' }
    foreach ($part in $Relative.Split('/')) {
        if ($part -in @('','.', '..') -or $part -match '[. ]$|[<>"|?*]' -or $part -match '^(?i:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)') { throw 'unsafe-relative-path' }
    }
    if ($Relative -eq '.git' -or $Relative.StartsWith('.git/') -or $Relative -eq '.br-dev-compliance' -or $Relative.StartsWith('.br-dev-compliance/')) { throw 'unsafe-relative-path' }
    return $Relative
}

function Test-ResultShape($Value, $Spec) {
    if ($Spec.PSObject.Properties['$ref']) { $Spec = $script:resultSchema.'$defs'.($Spec.'$ref'.Split('/')[-1]) }
    if ($Spec.PSObject.Properties['const'] -and $Value -cne $Spec.const) { throw 'result-const' }
    if ($Spec.PSObject.Properties['enum'] -and @($Spec.enum) -cnotcontains $Value) { throw 'result-enum' }
    $type = if ($null -eq $Value) { 'null' } elseif ($Value -is [Array]) { 'array' } elseif ($Value -is [string]) { 'string' } elseif ($Value -is [bool]) { 'boolean' } elseif ($Value -is [ValueType]) { 'number' } else { 'object' }
    if ($Spec.PSObject.Properties['type']) {
        $types = @($Spec.type)
        if ($types -notcontains $type -and -not ($types -contains 'integer' -and $type -eq 'number' -and [double]$Value -eq [Math]::Truncate([double]$Value))) { throw 'result-type' }
    }
    if ($type -eq 'object') {
        foreach ($key in @(Field $Spec 'required' @())) { if (-not $Value.PSObject.Properties[$key]) { throw 'result-required' } }
        foreach ($property in $Value.PSObject.Properties) {
            if ($Spec.properties.PSObject.Properties.Name -ccontains $property.Name) { Test-ResultShape $property.Value $Spec.properties.($property.Name) }
            elseif ((Field $Spec 'additionalProperties' $true) -eq $false) { throw 'result-unknown-property' }
        }
    }
    if ($type -eq 'array') {
        if ($Value.Count -lt (Field $Spec 'minItems' 0) -or $Value.Count -gt (Field $Spec 'maxItems' 9999)) { throw 'result-items' }
        if ((Field $Spec 'uniqueItems' $false) -and @($Value | ForEach-Object { Json $_ } | Sort-Object -Unique).Count -ne $Value.Count) { throw 'result-duplicate' }
        if ($Spec.PSObject.Properties['items']) { foreach ($item in $Value) { Test-ResultShape $item $Spec.items } }
    }
    if ($type -eq 'string') {
        if ($Value.Length -lt (Field $Spec 'minLength' 0) -or $Value.Length -gt (Field $Spec 'maxLength' 999999)) { throw 'result-length' }
        if ($Spec.PSObject.Properties['pattern'] -and $Value -cnotmatch $Spec.pattern) { throw 'result-pattern' }
        if ((Field $Spec 'format' '') -eq 'date-time') {
            if ($Value -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$') { throw 'result-date' }
            try { [void][DateTimeOffset]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture) } catch { throw 'result-date' }
        }
    }
    if ($type -eq 'number' -and ($Value -lt (Field $Spec 'minimum' -999999) -or $Value -gt (Field $Spec 'maximum' 999999))) { throw 'result-range' }
}

function Assert-Unique($Items, [string]$Key) {
    $values = @($Items | ForEach-Object { $_.$Key })
    if (@($values | Sort-Object -Unique).Count -ne $values.Count) { throw 'result-duplicate-id' }
}

function Assert-Result($Audit, [switch]$Historical) {
    if ([Text.Encoding]::UTF8.GetByteCount((Json $Audit)) -gt 65536) { throw 'result-size' }
    Test-ResultShape $Audit $script:resultSchema
    Assert-Unique $Audit.coverage 'check_id'; Assert-Unique $Audit.sources 'id'; Assert-Unique $Audit.findings 'id'
    $incomplete = @($Audit.sources | Where-Object { $_.status -ceq 'consultada' -and $_.fragments.Count -and $_.kind -cne 'metadados' }).Count -eq 0 -or $Audit.coverage.Count -eq 0
    $attempts = 0
    foreach ($source in $Audit.sources) {
        $local = $source.location.StartsWith('repo:', [StringComparison]::Ordinal)
        if ($local) {
            $relative = $source.location.Substring(5); [void](Safe-Relative $relative)
            if ($relative -ceq 'plano' -and -not $Historical) { throw 'result-virtual-plan-source' }
            if ($Audit.scope.examined -cnotcontains $relative -or $source.kind -cnotin @('licenca','metadados') -or $source.attempts -ne 0) { throw 'result-local-source' }
        } else {
            $uri = $null
            if (-not [Uri]::TryCreate($source.location, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.UserInfo) { throw 'result-url' }
            if ($source.kind -cin @('norma','ato_regulatorio') -and $uri.Host -notin @('www.planalto.gov.br','www2.camara.leg.br','legis.senado.leg.br','normas.leg.br','www.gov.br','dspace.mj.gov.br')) { throw 'result-origin' }
            # Preserve old records; a changed policy hash requests revalidation.
            if (-not $Historical -and $uri.Host -eq 'legis.senado.leg.br' -and $uri.AbsolutePath.TrimEnd('/') -ieq '/norma/27457334/publicacao/27457731') {
                $edition = Field $source 'edition_kind' $null
                if ($source.version -match 'consolidad|compilad|atualizad|consolidat|updated' -or ($edition -and $edition -cne 'original')) { throw 'incorrect-publication-edition' }
            }
            $attempts += $source.attempts
        }
        Assert-Unique $source.fragments 'locator'
        if ($source.status -ceq 'nao_consultada') {
            if ($null -ne $source.accessed_at -or $source.attempts -ne 0 -or $source.fragments.Count) { throw 'result-unperformed' }
        } else {
            if ((-not $local -and $source.attempts -lt 1) -or ($source.status -ceq 'consultada' -and -not $source.accessed_at)) { throw 'result-access' }
            if ($source.accessed_at -and [DateTimeOffset]::Parse($source.accessed_at) -gt [DateTimeOffset]::Parse($Audit.generated_at)) { throw 'result-future-access' }
        }
        if ($source.status -ceq 'indisponivel' -and ($source.fragments.Count -or -not $source.limitation)) { throw 'result-unavailable' }
    }
    if ($attempts -gt 3) { throw 'result-query-budget' }
    foreach ($finding in $Audit.findings) {
        $coverage = @($Audit.coverage | Where-Object { $_.check_id -ceq $finding.check_id })
        if ($coverage.Count -ne 1 -or $coverage[0].status -cnotin @('indicio','insuficiente')) { throw 'result-coverage' }
        foreach ($evidence in $finding.evidence) {
            if (@($Audit.scope.examined | Where-Object { $evidence.location -ceq $_ -or $evidence.location.StartsWith($_ + ':', [StringComparison]::Ordinal) }).Count -eq 0) { throw 'result-evidence' }
        }
        if (-not $finding.citations.Count -or $finding.missing_context.Count -or $finding.confidence -ceq 'insuficiente') { $incomplete = $true }
        foreach ($citation in $finding.citations) {
            $found = @($Audit.sources | Where-Object { $_.id -ceq $citation.source_id })
            if ($found.Count -ne 1) { throw 'result-source-id' }; $source = $found[0]
            if ($citation.location_status -ceq 'localizada' -and ($source.status -cne 'consultada' -or @($source.fragments | Where-Object { $_.locator -ceq $citation.locator }).Count -eq 0)) { throw 'result-locator' }
            if ($source.status -cne 'consultada' -and $citation.location_status -cne 'nao_consultada') { throw 'result-access-conflict' }
            if ($citation.support_status -ceq 'sustenta') {
                if ($citation.location_status -cne 'localizada') { throw 'result-support' }
                if ($citation.claim_kind -ceq 'obrigacao' -and $source.kind -cnotin @('norma','ato_regulatorio')) { throw 'result-authority' }
                if ($citation.claim_kind -ceq 'licenciamento' -and $source.kind -cne 'licenca') { throw 'result-license' }
            }
            if ($citation.location_status -cne 'localizada' -or $citation.support_status -cne 'sustenta') { $incomplete = $true }
        }
    }
    foreach ($coverage in $Audit.coverage) {
        if ($coverage.status -cin @('insuficiente','nao_examinado')) { $incomplete = $true }
        if ($coverage.status -ceq 'indicio' -and @($Audit.findings | Where-Object { $_.check_id -ceq $coverage.check_id }).Count -eq 0) { throw 'result-missing-finding' }
    }
    if ($Audit.status -ceq 'concluida_no_escopo' -and ($incomplete -or -not $Audit.scope.examined.Count)) { throw 'result-incomplete' }
    if ($Audit.status -ceq 'nao_executada' -and ($Audit.findings.Count -or $Audit.coverage.Count)) { throw 'result-unexecuted' }
    if ($Audit.status -cne 'concluida_no_escopo' -and -not $Audit.scope.limitations.Count) { throw 'result-limitation' }
}
