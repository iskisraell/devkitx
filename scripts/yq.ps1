# PowerShell YAML Parser (yq compatible)
# This script provides yq-like functionality without external dependencies
# Used by Ralphy for parsing tasks.yaml

param(
    [string]$Expression,
    [string]$File,
    [switch]$i,
    [switch]$o,
    [string]$OutputFormat = "yaml"
)

# Simple YAML parser for tasks.yaml structure
function Parse-Yaml {
    param([string]$Content)
    
    $result = @{}
    $currentTask = $null
    $tasks = @()
    $inTasks = $false
    
    $lines = $Content -split "`n"
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        
        # Skip comments and empty lines
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }
        
        # Check for task start
        if ($trimmed.StartsWith("- title:")) {
            if ($currentTask -and $tasks.Count -gt 0) {
                $tasks += $currentTask
            }
            $currentTask = @{ title = $trimmed.Substring(9).Trim().Trim('"'); description = ""; completed = $false; parallel_group = 0 }
            $inTasks = $true
            continue
        }
        
        # Check for description
        if ($currentTask -and $trimmed.StartsWith("description:")) {
            $currentTask.description = $trimmed.Substring(13).Trim().Trim('"')
            continue
        }
        
        # Check for completed
        if ($currentTask -and $trimmed.StartsWith("completed:")) {
            $currentTask.completed = ($trimmed.Substring(11).Trim() -eq "true")
            continue
        }
        
        # Check for parallel_group
        if ($currentTask -and $trimmed.StartsWith("parallel_group:")) {
            $currentTask.parallel_group = [int]($trimmed.Substring(16).Trim())
            continue
        }
    }
    
    if ($currentTask) { $tasks += $currentTask }
    
    return @{ tasks = $tasks }
}

# Main
if ($File -and (Test-Path $File)) {
    $content = Get-Content $File -Raw
    $data = Parse-Yaml -Content $content
    
    # Handle expressions
    if ($Expression) {
        if ($Expression -match 'parallel_group == (?<group>\d+)') {
            $group = [int]$Matches.group
            $tasks = $data.tasks | Where-Object { $_.parallel_group -eq $group -and -not $_.completed }
            if ($tasks) {
                $tasks | ForEach-Object { 
                    $output = "  - title: " + $_.title
                    if ($_.description) { $output += "`n    description: " + $_.description }
                    if ($_.completed) { $output += "`n    completed: true" }
                    $output += "`n    parallel_group: " + $_.parallel_group
                    Write-Output $output
                }
            }
        }
        elseif ($Expression -match 'length') {
            Write-Output ($data.tasks | Where-Object { -not $_.completed }).Count
        }
        elseif ($Expression -eq ".[].title" -or $Expression -eq ".[]") {
            $data.tasks | Where-Object { -not $_.completed } | ForEach-Object { 
                Write-Output "- title: $($_.title)"
            }
        }
        elseif ($Expression.StartsWith(".tasks[] | select(.parallel_group ==")) {
            # Handle: .tasks[] | select(.parallel_group == 2 and .completed != true)
            if ($Expression -match 'parallel_group == (?<group>\d+)') {
                $group = [int]$Matches.group
                $tasks = $data.tasks | Where-Object { $_.parallel_group -eq $group -and -not $_.completed }
                $tasks | ConvertTo-Json -Depth 10
            }
        }
        else {
            # Default: output all incomplete tasks as JSON
            $data.tasks | Where-Object { -not $_.completed } | ConvertTo-Json -Depth 10
        }
    }
    else {
        $data | ConvertTo-Json -Depth 10
    }
}
else {
    Write-Error "File not found: $File"
    exit 1
}
