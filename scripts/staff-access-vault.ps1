param(
  [ValidateSet('Protect', 'Read', 'Show')][string]$Action = 'Show',
  [Parameter(Mandatory = $true)][string]$Path
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[void][Reflection.Assembly]::LoadWithPartialName('System.Security')
if ($Action -eq 'Protect') {
  $payload = [Console]::In.ReadToEnd()
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $encrypted = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllText($Path, [Convert]::ToBase64String($encrypted), [Text.Encoding]::ASCII)
  [Array]::Clear($bytes, 0, $bytes.Length)
  exit 0
}
$encrypted = [Convert]::FromBase64String([IO.File]::ReadAllText($Path))
$bytes = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  $payload = [Text.Encoding]::UTF8.GetString($bytes)
  if ($Action -eq 'Read') { [Console]::Write($payload) }
  else {
    $vault = $payload | ConvertFrom-Json
    Write-Host "Lingkungan: $($vault.environment) | Database: $($vault.databaseHost)"
    $vault.accounts | Select-Object email, role, password | Format-Table -AutoSize
    Write-Host 'Simpan dan sampaikan hanya kepada staf yang berhak. Jangan menempelkan kata sandi ke chat atau repositori.'
  }
} finally {
  [Array]::Clear($bytes, 0, $bytes.Length)
}
