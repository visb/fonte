#!/usr/bin/env node
// Coleta da release (story 213), chamada pela skill fonte-release no passo 2.
//
//   node scripts/release/collect.mjs                 → JSON (tag anterior..HEAD)
//   node scripts/release/collect.mjs --from <ref>    → ponto de partida explícito
//                                                      (obrigatório na 1ª release)
//   node scripts/release/collect.mjs --markdown      → rascunho do vX.Y.Z.md
//
// Só LÊ o git. Não escreve arquivo, não cria tag, não faz push.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyze, formatDraft } from './lib.mjs';
import { lastTag, readCommits } from './git.mjs';

export const OPS_PACKAGE = path.join('apps', 'ops.fonte', 'package.json');

export function parseArgs(argv) {
  const options = { from: null, markdown: false, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      options.from = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith('--from=')) {
      options.from = arg.slice('--from='.length) || null;
    } else if (arg === '--markdown') {
      options.markdown = true;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.slice('--date='.length);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }
  return options;
}

export function readOpsVersion(cwd) {
  return JSON.parse(readFileSync(path.join(cwd, OPS_PACKAGE), 'utf8')).version;
}

export function collect({ cwd, from = null }) {
  const tag = lastTag(cwd);
  const currentVersion = readOpsVersion(cwd);
  const start = from ?? tag;
  if (!start) {
    // Primeira release sem ponto de partida: não despeja o histórico inteiro —
    // a skill pergunta ao usuário de onde começar.
    return {
      ...analyze({ rawCommits: [], lastTag: null, currentVersion }),
      range: null,
      needsStartingPoint: true,
    };
  }
  return {
    ...analyze({ rawCommits: readCommits(start, cwd), lastTag: tag, currentVersion }),
    range: `${start}..HEAD`,
    needsStartingPoint: false,
  };
}

export function main(argv, { cwd = process.cwd(), write = (text) => process.stdout.write(text), today = new Date() } = {}) {
  const options = parseArgs(argv);
  const report = collect({ cwd, from: options.from });
  if (options.markdown) {
    write(formatDraft(report, { date: options.date ?? today.toISOString().slice(0, 10) }));
  } else {
    write(`${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

// Ponto de entrada da CLI; o spawn real é exercitado em collect.test.mjs (o
// processo filho não entra na medição de cobertura do runner).
/* node:coverage ignore next 8 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[release:collect] ${error.message}\n`);
    process.exitCode = 1;
  }
}
