$rootDir = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $rootDir 'src'
$distDir = Join-Path $rootDir 'dist'
$preferredNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$nodeExe = if (Test-Path $preferredNode) { $preferredNode } else { 'node' }

if (Test-Path $distDir) {
    Remove-Item -LiteralPath $distDir -Recurse -Force
}

New-Item -ItemType Directory -Path $distDir | Out-Null

@'
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const sourceDir = process.argv[2];
const distDir = process.argv[3];

const rewriteImports = (code) =>
    code
        .replace(/from\s+(['"])([^'"]+)\.ts\1/g, "from $1$2.js$1")
        .replace(/import\s+(['"])([^'"]+)\.ts\1/g, "import $1$2.js$1");

const walk = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
            walk(absolutePath);
            continue;
        }

        if (entry.name.endsWith('.d.ts')) {
            continue;
        }

        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js')) {
            continue;
        }

        const relativePath = path.relative(sourceDir, absolutePath);
        const targetPath = path.join(distDir, relativePath.replace(/\.(ts|js)$/, '.js'));
        const sourceCode = fs.readFileSync(absolutePath, 'utf8');
        const transformed = stripTypeScriptTypes(sourceCode, { mode: 'transform' });
        const outputCode = rewriteImports(transformed);

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, outputCode, 'utf8');
    }
};

walk(sourceDir);
'@ | & $nodeExe - $sourceDir $distDir
