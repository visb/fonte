#!/usr/bin/env node
// Passo 1 do release.yml (story 213): a tag empurrada tem de bater com a versão
// do ops.fonte E ter changelog escrito. Qualquer divergência falha o workflow
// ANTES de gastar o build do APK.
//
//   node scripts/release/check-tag.mjs v1.2.0
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RELEASES_DIR = path.join('apps', 'release.fonte', 'content', 'releases');
const TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

/** Lista de problemas (vazia = tag válida). Puro: o I/O vem injetado. */
export function checkTag({ tag, opsVersion, releaseFileExists }) {
  const match = TAG.exec(tag ?? '');
  if (!match) return [`Tag "${tag}" fora do formato vX.Y.Z.`];

  const problems = [];
  const version = match[1];
  if (version !== opsVersion) {
    problems.push(
      `Tag ${tag} não bate com apps/ops.fonte/package.json (version ${opsVersion}). ` +
        'Faça o bump no package.json antes de taguear.',
    );
  }
  if (!releaseFileExists(`${tag}.md`)) {
    problems.push(`Changelog ausente: ${path.posix.join('apps/release.fonte/content/releases', `${tag}.md`)}.`);
  }
  return problems;
}

export function run(tag, { cwd = process.cwd() } = {}) {
  const opsVersion = JSON.parse(
    readFileSync(path.join(cwd, 'apps', 'ops.fonte', 'package.json'), 'utf8'),
  ).version;
  return checkTag({
    tag,
    opsVersion,
    releaseFileExists: (file) => existsSync(path.join(cwd, RELEASES_DIR, file)),
  });
}

/* node:coverage ignore next 12 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.argv[2];
  const problems = run(tag);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`[release:check-tag] ${problem}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`[release:check-tag] ${tag} ok\n`);
  }
}
