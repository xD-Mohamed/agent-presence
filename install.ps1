# Agent Presence direct Windows installer. PowerShell 5.1+; no npm or Git.
param(
  [ValidateSet('install','start','stop','uninstall')][string]$Action = 'install',
  [string]$Revision = 'main',
  [string[]]$Options = @(),
  [switch]$UsePortableNode
)

function Test-AgentNodeVersion([string]$Version) {
  if ($Version -notmatch '^v?(\d+)\.(\d+)\.(\d+)$') { return $false }
  return ([int]$Matches[1] -gt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 18))
}
function Get-AgentNodeDistribution([string]$Architecture) {
  if ($Architecture -eq 'X64') { $Architecture='AMD64' }
  switch ($Architecture.ToUpperInvariant()) {
    'AMD64' { $arch='x64'; $hash='6e50ce5498c0cebc20fd39ab3ff5df836ed2f8a31aa093cecad8497cff126d70' }
    'ARM64' { $arch='arm64'; $hash='a7b7c68490e4a8cde1921fe5a0cfb3001d53f9c839e416903e4f28e727b62f60' }
    default { throw 'Agent Presence requires 64-bit Windows (x64 or ARM64).' }
  }
  $name="node-v24.14.1-win-$arch.zip"
  return @{Name=$name; Folder=$name.Substring(0,$name.Length-4); Hash=$hash; Url="https://nodejs.org/dist/v24.14.1/$name"}
}
function Receive-AgentFile([string]$Url,[string]$Destination) {
  $uri=[uri]$Url
  if ($uri.Scheme -ne 'https') { throw 'Downloads require HTTPS.' }
  for ($attempt=1;$attempt -le 3;$attempt++) {
    try {
      Invoke-WebRequest -Uri $uri -OutFile $Destination -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
      if (!(Test-Path -LiteralPath $Destination) -or (Get-Item -LiteralPath $Destination).Length -eq 0) { throw 'The server returned an empty download.' }
      return
    } catch {
      if ($attempt -eq 3) {
        throw "Could not download from $($uri.Host) after 3 attempts. Check internet/DNS and proxy/firewall access. If an AI sandbox blocked access, run this command in a normal PowerShell terminal. Details: $($_.Exception.Message)"
      }
      Start-Sleep -Seconds $attempt
    }
  }
}
function Get-AgentFileHash([string]$File) {
  $stream=[IO.File]::OpenRead($File)
  $algorithm=[Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
function Assert-AgentFileHash([string]$File,[string]$Expected) {
  if ((Get-AgentFileHash $File) -ne $Expected) { throw 'Node download checksum does not match the official release. Nothing from this archive was run. Retry the download.' }
}
function Assert-AgentNotLink([string]$Path) {
  if ((Test-Path -LiteralPath $Path) -and ((Get-Item -LiteralPath $Path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing to overwrite a linked installation path: $Path" }
}
function New-AgentDirectory([string]$Path) {
  Assert-AgentNotLink $Path
  $probe=Join-Path $Path ('.write-check-' + [guid]::NewGuid())
  try { [IO.Directory]::CreateDirectory($Path) | Out-Null; [IO.File]::WriteAllText($probe,''); Remove-Item -LiteralPath $probe -Force }
  catch { throw "Cannot write to $Path. Run as your normal Windows user and check folder permissions or security software. Details: $($_.Exception.Message)" }
}
function Expand-AgentPackage([string]$Zip,[string]$Destination) {
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  New-AgentDirectory $Destination
  $archive=[IO.Compression.ZipFile]::OpenRead($Zip)
  try {
    $packages=@($archive.Entries | Where-Object { $_.FullName -match '^[^/]+/package\.json$' })
    if ($packages.Count -ne 1) { throw 'The downloaded archive is not a valid Agent Presence package.' }
    $prefix=$packages[0].FullName.Substring(0,$packages[0].FullName.Length-'package.json'.Length)
    foreach ($entry in $archive.Entries) {
      if (!$entry.FullName.StartsWith($prefix,[StringComparison]::Ordinal)) { continue }
      $relative=$entry.FullName.Substring($prefix.Length)
      # Extract only known runtime file shapes. No ZIP paths can escape staging.
      if ($relative -notmatch '^(package\.json|README\.md|LICENSE|THIRD_PARTY\.md|SECURITY\.md|src/[a-z-]+\.(js|cs))$') { continue }
      $target=Join-Path $Destination $relative
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$false)
    }
  } finally { $archive.Dispose() }
  $package=Get-Content -LiteralPath (Join-Path $Destination 'package.json') -Raw | ConvertFrom-Json
  if ($package.name -ne 'agent-presence' -or !(Test-Path -LiteralPath (Join-Path $Destination 'src/cli.js'))) { throw 'The downloaded archive is missing the Agent Presence runtime.' }
}
function Test-AgentNode([string]$Node) {
  if (!$Node -or !(Test-Path -LiteralPath $Node -PathType Leaf)) { return $false }
  try {
    $version=(& $Node --version 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or !(Test-AgentNodeVersion $version)) { return $false }
    & $Node --disable-warning=ExperimentalWarning --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(':memory:'); db.close();" 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}
function Get-AgentNode([string]$Staging,[string]$LocalData,[bool]$Portable) {
  if (!$Portable) {
    $command=Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and (Test-AgentNode $command.Source)) { return $command.Source }
  }
  try { $architecture=[Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() }
  catch {
    $architecture=$env:PROCESSOR_ARCHITEW6432
    if (!$architecture) { $architecture=$env:PROCESSOR_ARCHITECTURE }
  }
  $distribution=Get-AgentNodeDistribution $architecture
  $runtimeRoot=Join-Path $LocalData 'Programs/Agent Presence Runtime'
  New-AgentDirectory $runtimeRoot
  $runtime=Join-Path $runtimeRoot $distribution.Folder
  Assert-AgentNotLink $runtime
  $node=Join-Path $runtime 'node.exe'
  $marker=Join-Path $runtime 'agent-presence-runtime.json'
  if (Test-Path -LiteralPath $runtime) {
    Assert-AgentNotLink $node
    Assert-AgentNotLink $marker
    if (!(Test-Path -LiteralPath $marker)) { throw "An unrecognized runtime directory already exists at $runtime. It was not overwritten." }
    $record=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if ($record.id -ne 'agent-presence-node' -or $record.archiveSha256 -ne $distribution.Hash -or (Get-AgentFileHash $node) -ne $record.nodeSha256 -or !(Test-AgentNode $node)) { throw "The private Node runtime failed validation. Check $runtime before reinstalling." }
    return $node
  }
  Write-Host 'Preparing a verified private Node.js runtime (no admin rights or PATH changes)...'
  $zip=Join-Path $Staging $distribution.Name
  Receive-AgentFile $distribution.Url $zip
  Assert-AgentFileHash $zip $distribution.Hash
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  $archive=[IO.Compression.ZipFile]::OpenRead($zip)
  $prepared=Join-Path $Staging 'node-runtime'
  $preparedNode=Join-Path $prepared 'node.exe'
  try {
    New-AgentDirectory $prepared
    foreach ($name in @('node.exe','LICENSE')) {
      $nodeEntries=@($archive.Entries | Where-Object { $_.FullName -eq ($distribution.Folder + '/' + $name) })
      if ($nodeEntries.Count -ne 1) { throw 'Verified Node archive is missing an expected file.' }
      [IO.Compression.ZipFileExtensions]::ExtractToFile($nodeEntries[0],(Join-Path $prepared $name),$false)
    }
    if (!(Test-AgentNode $preparedNode)) { throw 'The downloaded Node runtime could not run. Check Windows compatibility or a matching security-software notification.' }
    @{id='agent-presence-node';archiveSha256=$distribution.Hash;nodeSha256=(Get-AgentFileHash $preparedNode)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $prepared 'agent-presence-runtime.json') -Encoding UTF8
    # Publish only a complete runtime. A crash leaves disposable staging, never a
    # partial final directory that would prevent a later installation.
    $resolvedPrepared=[IO.Path]::GetFullPath($prepared)
    $resolvedRuntime=[IO.Path]::GetFullPath($runtime)
    if ([IO.Path]::GetDirectoryName($resolvedPrepared) -ne [IO.Path]::GetFullPath($Staging).TrimEnd('\') -or [IO.Path]::GetDirectoryName($resolvedRuntime) -ne [IO.Path]::GetFullPath($runtimeRoot).TrimEnd('\')) { throw 'Refusing to move a runtime outside the staging/install roots.' }
    Assert-AgentNotLink $resolvedPrepared
    Assert-AgentNotLink $resolvedRuntime
    [IO.Directory]::Move($resolvedPrepared,$resolvedRuntime)
  } finally { $archive.Dispose() }
  return $node
}
function Remove-AgentStaging([string]$CacheRoot,[string]$Staging) {
  $cache=[IO.Path]::GetFullPath($CacheRoot).TrimEnd('\') + '\'
  $resolved=[IO.Path]::GetFullPath($Staging)
  if (!$resolved.StartsWith($cache,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne $cache.TrimEnd('\') -or [IO.Path]::GetFileName($resolved) -notmatch '^[0-9a-f-]{36}$') { throw 'Refusing to clean a path outside the installer staging directory.' }
  Assert-AgentNotLink $resolved
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
function Invoke-AgentBootstrap {
  param([string]$Action,[string]$Revision,[string[]]$Options,[bool]$Portable)
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This installer is for Windows. See the README for macOS/Linux.' }
  if ($Revision -notmatch '^(main|[0-9a-fA-F]{40}|v?\d+\.\d+\.\d+)$') { throw 'Use main, a release tag or a full commit SHA for Revision.' }
  $localData=$env:LOCALAPPDATA
  if (!$localData) { $localData=[Environment]::GetFolderPath('LocalApplicationData') }
  if (!$localData) { throw 'Windows did not provide a writable per-user application directory.' }
  $installed=Join-Path $localData 'Programs/Codex Discord RPC'
  if ($Action -ne 'install') {
    $record=Get-Content -LiteralPath (Join-Path $installed 'install-record.json') -Raw | ConvertFrom-Json
    if ($record.id -ne 'codex-discord-rpc') { throw 'No managed Agent Presence installation was found.' }
    & $record.node --disable-warning=ExperimentalWarning (Join-Path $installed 'src/cli.js') $Action
    if ($LASTEXITCODE -ne 0) { throw "Agent Presence $Action failed; see the diagnostic above." }
    return
  }
  $cache=Join-Path $localData 'AgentPresence/InstallCache'
  New-AgentDirectory $cache
  $staging=Join-Path $cache ([guid]::NewGuid().ToString())
  New-AgentDirectory $staging
  try {
    Write-Host 'Downloading Agent Presence directly over HTTPS (no npm, Git or SSH)...'
    $zip=Join-Path $staging 'agent-presence.zip'
    Receive-AgentFile "https://codeload.github.com/xD-Mohamed/agent-presence/zip/$Revision" $zip
    $package=Join-Path $staging 'package'
    Expand-AgentPackage $zip $package
    $node=Get-AgentNode $staging $localData $Portable
    Write-Host 'Installing the background runtime and per-user login startup...'
    & $node --disable-warning=ExperimentalWarning (Join-Path $package 'src/cli.js') install @Options
    if ($LASTEXITCODE -ne 0) { throw 'Installation did not complete. If Windows blocked the login task or writes, run this installer in a normal PowerShell terminal with your own user account and review the diagnostic above.' }
    Write-Host 'Agent Presence is installed. Use Codex or Claude Code with Discord desktop open.'
    Write-Host ('Offline control: & ''' + $node.Replace("'","''") + ''' ''' + (Join-Path $installed 'src/cli.js').Replace("'","''") + ''' stop')
    Write-Host 'Replace stop with start or uninstall as needed. A private Node runtime, if downloaded, is retained for reinstalls.'
  } finally {
    try { Remove-AgentStaging $cache $staging } catch { Write-Warning "Temporary installer files remain at $staging; $($_.Exception.Message)" }
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  $agentPreviousError=$ErrorActionPreference
  $agentPreviousProgress=$ProgressPreference
  $agentPreviousTls=[Net.ServicePointManager]::SecurityProtocol
  $agentMutex=$null
  $agentOwnsMutex=$false
  try {
    $ErrorActionPreference='Stop'
    $ProgressPreference='SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol=$agentPreviousTls -bor [Net.SecurityProtocolType]::Tls12
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This installer is for Windows.' }
    $agentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $agentMutex=[Threading.Mutex]::new($false,('Local\AgentPresenceInstaller-' + $agentSid))
    try { $agentOwnsMutex=$agentMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $agentOwnsMutex=$true }
    if (!$agentOwnsMutex) { throw 'Another Agent Presence installation or control command is running. Wait for it to finish, then retry.' }
    Invoke-AgentBootstrap -Action $Action -Revision $Revision -Options $Options -Portable ([bool]$UsePortableNode)
  } finally {
    if ($agentOwnsMutex) { $agentMutex.ReleaseMutex() }
    if ($agentMutex) { $agentMutex.Dispose() }
    $ErrorActionPreference=$agentPreviousError
    $ProgressPreference=$agentPreviousProgress
    [Net.ServicePointManager]::SecurityProtocol=$agentPreviousTls
  }
}
