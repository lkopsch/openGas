# openGas · v0.0.1-beta

Aplicativo pessoal para acompanhar abastecimentos e despesas do carro, disponível como webapp e APK Android. Interface responsiva com temas claro, escuro e sistema.

## Recursos

- Perfis locais, histórico, edição e exclusão de abastecimentos e despesas.
- Consumo, custo por quilômetro, preços e gráficos mensais.
- Valores monetários digitados da direita para a esquerda.
- Leitura de notas fiscais com OCR e formulário preenchido para revisão.
- Exportação de todos os perfis em XLSX; importação e exportação XLSX no Android.

## Webapp

Requisitos: Git e Node.js **22.20 ou superior**, com npm. O backend usa o SQLite integrado ao Node.

```sh
git clone https://github.com/lkopsch/openGas.git
cd openGas
npm ci
npm run build
npm start
```

Abra **http://localhost:3014**. O servidor atende apenas neste computador. Para desenvolvimento, pare o servidor de produção e execute `npm run dev`, também na porta 3014.

Na primeira execução, o banco `data/opengas.db` é criado vazio. Crie um perfil pela interface. O banco e seus backups não fazem parte do repositório. Não há sincronização automática entre web e Android.

### Iniciar com o Windows

Após compilar, `scripts/start-opengas.ps1` inicia o servidor em segundo plano e evita duplicar a porta. Para configurar a inicialização automática, execute no PowerShell, na raiz do projeto:

```powershell
$projectPath = (Get-Location).Path
$startupPath = [Environment]::GetFolderPath('Startup')
$scriptPath = Join-Path $projectPath 'scripts\start-opengas.ps1'
$vbsPath = Join-Path $startupPath 'openGas.vbs'
$vbsContent = 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""' + $scriptPath + '""", 0, False'
Set-Content -LiteralPath $vbsPath -Value $vbsContent -Encoding Unicode
```

O servidor será iniciado ao entrar no Windows. Logs em `logs/`. Para desativar, remova `openGas.vbs` da pasta Inicializar; para abrir essa pasta, use `shell:startup` em Executar. Mantenha a pasta do projeto no mesmo local ou recrie o arquivo após movê-la.

## App Android

Android **6.0 ou superior**. O app inclui interface, SQLite e modelo OCR em português no APK, funcionando offline sem o servidor web. Uma instalação nova começa **sem perfis e sem lançamentos**. O banco do computador nunca é incluído no APK.

### Compilar APK no Windows

Instale Node.js 22.20+, **JDK 21** e Android Studio. Pelo SDK Manager, instale **Android SDK Platform 35** e Android SDK Build-Tools **35.0.0**. A primeira compilação precisa de internet para baixar dependências; o uso do app é offline.

No PowerShell, na raiz do projeto:

```powershell
npm ci
$env:OPENGAS_JAVA_HOME = 'C:\caminho\para\jdk-21'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
npm run apk
```

`OPENGAS_JAVA_HOME` aponta para a pasta do JDK, sem `bin`. O script também aceita `JAVA_HOME`; `ANDROID_HOME` pode apontar para outro local do SDK. `npm run apk` compila a interface mobile, prepara os modelos offline e ícones, sincroniza o Capacitor e executa o Gradle.

Resultado: **`artifacts/openGas-android.apk`**. É um APK **debug** instalável, assinado com a chave de desenvolvimento local. Não é uma versão preparada para publicação na Play Store. Para atualizar uma instalação existente, use a mesma chave; recompilar em outro computador pode exigir desinstalação, portanto exporte seus dados antes.

Para instalar, transfira o APK para o celular e abra-o, autorizando a instalação por esse aplicativo quando o Android solicitar. Com depuração USB e Android Platform-Tools, também é possível usar:

```sh
adb install -r artifacts/openGas-android.apk
```

### Android Studio ou outros sistemas

```sh
npm ci
npm run build:android
node scripts/android-icons.mjs
```

Abra a pasta `android` no Android Studio, configure JDK 21/SDK 35 e gere um APK debug. No Linux/macOS, com `JAVA_HOME` e `ANDROID_HOME` configurados:

```sh
cd android
chmod +x gradlew
./gradlew assembleDebug
```

O resultado do Gradle fica em `android/app/build/outputs/apk/debug/app-debug.apk`. Execute `npm run build:android` novamente após alterar a interface para atualizar os assets nativos.

### Importar seu histórico

1. No webapp, abra **Ajustes → Exportar banco completo (XLSX)**.
2. Transfira o XLSX para o celular.
3. No Android, abra **Ajustes → Importar banco (XLSX)** e selecione o arquivo.
4. Revise as quantidades e confirme **Importar e mesclar**.

Todos os perfis são importados. IDs iguais são atualizados e os demais registros existentes são mantidos. O arquivo é validado antes de alterar o banco; o formato deve ser o XLSX exportado pelo openGas. Veja o [contrato do XLSX](docs/xlsx-format.md). No Android, a exportação abre o seletor nativo para escolher onde salvar.

O backup JSON por perfil serve para exportação adicional; esta beta oferece restauração pela interface **apenas via XLSX no Android**. O webapp não possui importador XLSX nesta versão. Os perfis são locais e não representam contas com autenticação.

## OCR e revisão de notas

Web e Android compartilham o parser que extrai os campos do texto, com Tesseract em português. O tratamento de imagem difere: Sharp no servidor web e Canvas/motor WASM no Android. As leituras podem variar entre plataformas.

Em **Novo lançamento**, escolha a metade de abastecimento ou despesa do botão de importação. Após a animação de análise, o formulário abre preenchido para revisão. No abastecimento, informe o odômetro e confira tanque cheio/parcial antes de salvar. JPG, PNG e WebP de até 5 MB são suportados. Fotos podem gerar erros em números, nomes e identificadores: revise os campos, especialmente litros, preço e impostos.

## Verificação e estrutura

```sh
npm test
npm run build
```

Os testes cobrem consumo, máscaras monetárias, parser de notas e integridade da exportação/importação XLSX. Para QA de interface, instale Chromium com `npx playwright install chromium`. Scripts `scripts/qa*.mjs` são verificações locais, algumas dependem de banco de teste, arquivo XLSX, emulador ou foto de referência. Para as verificações de OCR, configure `OPENGAS_RECEIPT_PATH` com o caminho da imagem; elas não são necessárias para compilar o APK.

- `src/`: interface React, Zustand, estilos e parser compartilhado.
- `src/lib/mobile/`: SQLite local, armazenamento, OCR offline e transferência de dados.
- `server/` e `server.ts`: backend web, exportação e OCR.
- `android/`: projeto Capacitor/Gradle e seletor de exportação nativo.
- `shared/schema.sql` e `data/schema.sql`: estrutura do banco, sem dados de usuários.
- `scripts/`: compilação, ícones, inicialização e verificações.

Builds, bancos, notas fiscais, backups e capturas de testes são ignorados pelo Git. A versão beta utiliza React, Vite, React Router, Zustand, Capacitor, SQLite/sql.js, Tesseract e ExcelJS.
