param([Parameter(Mandatory=$true)][string]$Revision)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$root=Join-Path ([IO.Path]::GetTempPath()) ('agent-bootstrap-integration-' + [guid]::NewGuid())
$previous=@{}
foreach($key in @('APPDATA','LOCALAPPDATA','CODEX_HOME','CLAUDE_CONFIG_DIR','PATH')) { $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
# This job must have its own machine; never stop another publisher for a test.
$socket=New-Object Net.Sockets.TcpClient
try { $socket.Connect('127.0.0.1',64637); throw 'Bootstrap integration requires an isolated host.' }
catch [Net.Sockets.SocketException] { }
finally { $socket.Dispose() }
$env:APPDATA=Join-Path $root "Roaming Unicode O'Brien"
$env:LOCALAPPDATA=Join-Path $root "Local Unicode O'Brien"
$env:CODEX_HOME=Join-Path $root 'codex'
$env:CLAUDE_CONFIG_DIR=Join-Path $root 'claude'
$env:PATH="$env:SystemRoot\System32;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
$installed=Join-Path $env:LOCALAPPDATA 'Programs/Codex Discord RPC'
try {
  foreach($tool in @('node.exe','npm.cmd','git.exe')) { if(Get-Command $tool -ErrorAction SilentlyContinue) { throw "Test PATH still exposes $tool" } }
  & (Join-Path $repoRoot 'install.ps1') -Revision $Revision -UsePortableNode -Options @('--hide-project','--hide-diff')
  $record=Get-Content -LiteralPath (Join-Path $installed 'install-record.json') -Raw | ConvertFrom-Json
  if($record.node -notlike '*Agent Presence Runtime*') { throw 'Expected the private runtime' }
  if(!(Test-Path -LiteralPath $record.node)) { throw 'Private Node missing' }
  & (Join-Path $repoRoot 'install.ps1') -Revision $Revision -UsePortableNode
  $updated=Get-Content -LiteralPath (Join-Path $installed 'install-record.json') -Raw | ConvertFrom-Json
  if($updated.node -ne $record.node -or $updated.args -notcontains '--hide-project' -or $updated.args -notcontains '--hide-diff') { throw 'Update lost runtime/preferences' }
  & (Join-Path $repoRoot 'install.ps1') -Action stop
  & (Join-Path $repoRoot 'install.ps1') -Action start
  & (Join-Path $repoRoot 'install.ps1') -Action uninstall
  if(Test-Path -LiteralPath (Join-Path $installed 'src/cli.js')) { throw 'Uninstall left the runtime behind' }
  if(!(Test-Path -LiteralPath $record.node)) { throw 'Shared private Node should be retained for reinstalls' }
  Write-Output 'Direct HTTPS install/update/control/uninstall passed with no Node, npm or Git in PATH.'
} finally {
  $recordPath=Join-Path $installed 'install-record.json'
  if(Test-Path -LiteralPath $recordPath) {
    $cleanupRecord=Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    & $cleanupRecord.node (Join-Path $installed 'src/cli.js') uninstall
  }
  foreach($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
  $resolved=[IO.Path]::GetFullPath($root)
  if(!$resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or !(Split-Path $resolved -Leaf).StartsWith('agent-bootstrap-integration-')) { throw 'Unsafe integration cleanup path' }
  for($attempt=0;$attempt -lt 20;$attempt++) {
    try { if(Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }; break }
    catch { if($attempt -eq 19) { throw }; Start-Sleep -Milliseconds 250 }
  }
}
