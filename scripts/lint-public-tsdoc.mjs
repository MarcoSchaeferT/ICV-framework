/** Lint TSDoc on every source module re-exported by the TypeDoc entry point. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const entry = path.join(root, 'src', 'framework', 'index.ts');
const tsconfig = path.join(root, 'tsconfig.typedoc.json');
const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
}
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(tsconfig));
if (parsed.errors.length) {
  throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
}

const source = ts.createSourceFile(entry, ts.sys.readFile(entry), ts.ScriptTarget.Latest, true);
const files = new Set([entry]);
for (const statement of source.statements) {
  if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) {
    continue;
  }
  const resolved = ts.resolveModuleName(statement.moduleSpecifier.text, entry, parsed.options, ts.sys).resolvedModule?.resolvedFileName;
  const localFile = resolved && path.resolve(resolved);
  if (!localFile || !localFile.startsWith(`${path.join(root, 'src')}${path.sep}`)) {
    throw new Error(`Cannot resolve local framework export: ${statement.moduleSpecifier.text}`);
  }
  files.add(localFile);
}
if (files.size < 2) throw new Error('No framework source modules were found');

const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const args = [
  eslint,
  '--no-config-lookup',
  '--ext', '.ts,.tsx',
  '--parser', '@typescript-eslint/parser',
  '--plugin', 'tsdoc',
  '--plugin', 'react-hooks',
  '--rule', 'tsdoc/syntax:error',
  '--quiet',
  ...[...files].sort(),
];
console.log(`Checking TSDoc in ${files.size} public API source files.`);
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
