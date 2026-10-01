$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\jbr-21.0.11' }
if ($env:OPENGAS_JAVA_HOME) { $env:JAVA_HOME = $env:OPENGAS_JAVA_HOME }
if (-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw 'Informe um JDK 21 em OPENGAS_JAVA_HOME.' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
Set-Location -LiteralPath (Join-Path $projectPath 'android')
$sdkProperty = $env:ANDROID_HOME.Replace('\','/').Replace(':','\:')
Set-Content -LiteralPath local.properties -Value "sdk.dir=$sdkProperty" -Encoding ascii
& .\gradlew.bat assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar APK.' }
New-Item -ItemType Directory -Force (Join-Path $projectPath 'artifacts') | Out-Null
Copy-Item -LiteralPath 'app\build\outputs\apk\debug\app-debug.apk' -Destination (Join-Path $projectPath 'artifacts\openGas-android.apk')
