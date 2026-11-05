param([string]$RepoRoot)
$ErrorActionPreference = 'Stop'
. ([scriptblock]::Create((Get-Content -LiteralPath (Join-Path $RepoRoot 'install.ps1') -Raw)))
function Assert($Condition, $Message) { if (!$Condition) { throw $Message } }
function Assert-Throws([scriptblock]$Run, [string]$Pattern) {
  $caught = $false
  try { & $Run } catch { $caught = $true; Assert ($_.Exception.Message -match $Pattern) "Unexpected error: $_" }
  Assert $caught 'Expected operation to fail'
}
Assert (!(Test-AgentNodeVersion 'v22.17.0')) 'Old Node was accepted'
Assert (!(Test-AgentNodeVersion 'v20.19.0')) 'Node 20 was accepted'
Assert (Test-AgentNodeVersion 'v22.18.0') 'Minimum Node rejected'
Assert (Test-AgentNodeVersion 'v24.14.1') 'Node 24 rejected'
Assert (!(Test-AgentNodeVersion 'not a version')) 'Invalid version accepted'
Assert ((Get-AgentNodeDistribution 'AMD64').Name -eq 'node-v24.14.1-win-x64.zip') 'Wrong x64 download'
Assert ((Get-AgentNodeDistribution 'X64').Name -eq 'node-v24.14.1-win-x64.zip') 'Runtime architecture name rejected'
Assert ((Get-AgentNodeDistribution 'ARM64').Name -eq 'node-v24.14.1-win-arm64.zip') 'Wrong arm64 download'
Assert-Throws { Get-AgentNodeDistribution 'x86' } '64-bit'
$root = Join-Path ([IO.Path]::GetTempPath()) ('agent-bootstrap-unit-' + [guid]::NewGuid())
[IO.Directory]::CreateDirectory($root) | Out-Null
try {
  $file = Join-Path $root 'download.bin'
  $script:attempts = 0
  function Invoke-WebRequest {
    param($Uri,$OutFile,[switch]$UseBasicParsing,$TimeoutSec,$ErrorAction)
    $script:attempts++
    if ($script:attempts -lt 3) { throw 'test DNS failure' }
    [IO.File]::WriteAllText($OutFile,'downloaded')
  }
  function Start-Sleep { param($Seconds) }
  Receive-AgentFile 'https://example.test/package.zip' $file
  Assert ((Get-Content -LiteralPath $file -Raw) -eq 'downloaded') 'Download content missing'
  Assert ($script:attempts -eq 3) 'Retry budget not respected'
  Assert-AgentFileHash $file 'b7a8a844a613be796bc1892dc480f9d92c50d32a5713a87758e5c5addc4ec814'
  Assert-Throws { Assert-AgentFileHash $file ('0' * 64) } 'checksum'
  Assert-Throws { Receive-AgentFile 'http://example.test/plaintext' $file } 'HTTPS'
  function Invoke-WebRequest { throw 'test DNS failure' }
  Assert-Throws { Receive-AgentFile 'https://example.test/package.zip' $file } 'example.test.*DNS'
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  $zip = Join-Path $root 'package.zip'
  $archive = [IO.Compression.ZipFile]::Open($zip,[IO.Compression.ZipArchiveMode]::Create)
  foreach ($pair in @(
    @('repo/package.json','{"name":"agent-presence","version":"0.5.0"}'),
    @('repo/src/cli.js','test cli'),
    @('repo/src/clawd.js','test companion'),
    @('repo/LICENSE','test license'),
    @('repo/../escape.txt','must never escape'),
    @('repo/.env','must not be extracted')
  )) {
    $entry=$archive.CreateEntry($pair[0]);$writer=New-Object IO.StreamWriter($entry.Open());$writer.Write($pair[1]);$writer.Dispose()
  }
  $archive.Dispose()
  $destination=Join-Path $root 'extracted'
  Expand-AgentPackage $zip $destination
  Assert ((Get-Content -LiteralPath (Join-Path $destination 'src/cli.js') -Raw) -eq 'test cli') 'CLI missing'
  Assert (Test-Path -LiteralPath (Join-Path $destination 'src/clawd.js')) 'New modules missing'
  Assert (!(Test-Path -LiteralPath (Join-Path $root 'escape.txt'))) 'Archive escaped target'
  Assert (!(Test-Path -LiteralPath (Join-Path $destination '.env'))) 'Unallowlisted file extracted'
  Assert-Throws { Remove-AgentStaging $root (Join-Path $root 'not-a-guid') } 'Refusing'

  # A failed/interrupted runtime must never be visible at its final location.
  $script:runtimeZip=Join-Path $root 'node-fixture.zip'
  $nodeArchive=[IO.Compression.ZipFile]::Open($script:runtimeZip,[IO.Compression.ZipArchiveMode]::Create)
  foreach($name in @('node.exe','LICENSE')) {
    $entry=$nodeArchive.CreateEntry('node-v24.14.1-win-x64/'+$name)
    $writer=New-Object IO.StreamWriter($entry.Open());$writer.Write('fixture');$writer.Dispose()
  }
  $nodeArchive.Dispose()
  $script:fixtureHash=Get-AgentFileHash $script:runtimeZip
  function Get-AgentNodeDistribution {
    return @{Name='node.zip';Folder='node-v24.14.1-win-x64';Hash=$script:fixtureHash;Url='https://example.test/node.zip'}
  }
  function Receive-AgentFile { param($Url,$Destination); Copy-Item -LiteralPath $script:runtimeZip -Destination $Destination }
  $local=Join-Path $root 'Local'
  $script:finalRuntime=Join-Path $local 'Programs/Agent Presence Runtime/node-v24.14.1-win-x64'
  $script:allowNode=$false
  function Test-AgentNode {
    param($Node)
    Assert (!(Test-Path -LiteralPath $script:finalRuntime)) 'Runtime was published before validation'
    return $script:allowNode
  }
  $firstStage=Join-Path $root 'first-stage';New-AgentDirectory $firstStage
  Assert-Throws { Get-AgentNode $firstStage $local $true } 'could not run'
  Assert (!(Test-Path -LiteralPath $script:finalRuntime)) 'Failure left a partial published runtime'
  $script:allowNode=$true
  $secondStage=Join-Path $root 'second-stage';New-AgentDirectory $secondStage
  $installedNode=Get-AgentNode $secondStage $local $true
  Assert (Test-Path -LiteralPath $installedNode) 'Retry did not install runtime'
  Assert (Test-Path -LiteralPath (Join-Path $script:finalRuntime 'agent-presence-runtime.json')) 'Published runtime missing marker'
  Write-Output 'Bootstrap unit checks passed.'
} finally {
  $resolved=[IO.Path]::GetFullPath($root)
  if (!$resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or !(Split-Path $resolved -Leaf).StartsWith('agent-bootstrap-unit-')) { throw 'Unsafe test cleanup' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
