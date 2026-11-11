#!/usr/bin/env node
/**
 * Troca a versão da aplicação em TODOS os lugares de uma vez (padrão Sebratel:
 * a versão é a mesma no package.json, no package-lock.json e na tag da imagem
 * do compose, e o CI recusa divergência).
 *
 *   npm run version:set -- 1.2.3
 *
 * patch = correção · minor = funcionalidade compatível · major = quebra de contrato.
 * Todo PR que muda código sobe a versão (o CI recusa versão igual ou menor que a do ambiente).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Uso: npm run version:set -- X.Y.Z   (ex.: 1.2.3, sem -beta/-SNAPSHOT)');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changed = [];

const editJson = (rel, edit) => {
  const file = join(root, rel);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  edit(data);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  changed.push(rel);
};

for (const pkg of ['package.json', 'server/package.json', 'web/package.json']) {
  editJson(pkg, (data) => { data.version = version; });
}
for (const lock of ['server/package-lock.json', 'web/package-lock.json']) {
  editJson(lock, (data) => {
    data.version = version;
    if (data.packages?.['']) data.packages[''].version = version;
  });
}

// tag da imagem, label e build arg: ${APP_VERSION:-X.Y.Z}
const composeFile = join(root, 'docker-compose.yml');
const compose = readFileSync(composeFile, 'utf8');
const updated = compose.replace(/\$\{APP_VERSION:-\d+\.\d+\.\d+\}/g, `\${APP_VERSION:-${version}}`);
if (updated === compose && !compose.includes(`APP_VERSION:-${version}`)) {
  console.error('docker-compose.yml: não achei ${APP_VERSION:-X.Y.Z} para trocar.');
  process.exit(1);
}
writeFileSync(composeFile, updated);
changed.push('docker-compose.yml');

console.log(`Versão ${version} em: ${changed.join(', ')}`);
