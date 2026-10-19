// Helper de teste (fora da cobertura): repositório git descartável em diretório
// temporário, com o mínimo que o script de release lê.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const IDENTITY = [
  '-c', 'user.name=Release Test',
  '-c', 'user.email=release-test@example.invalid',
  '-c', 'commit.gpgsign=false',
  '-c', 'tag.gpgsign=false',
  '-c', 'core.hooksPath=/dev/null',
];

export function createRepo({ opsVersion = '1.0.0' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fonte-release-'));
  const run = (...args) =>
    execFileSync('git', [...IDENTITY, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });

  run('init', '-q', '-b', 'main');

  const write = (file, content) => {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  };

  write('apps/ops.fonte/package.json', JSON.stringify({ name: 'ops.fonte', version: opsVersion }));
  let counter = 0;

  return {
    dir,
    write,
    commit(subject, { files = [`notes/${(counter += 1)}.txt`], body = '' } = {}) {
      for (const file of files) write(file, `${subject}\n${Date.now()}-${counter}\n`);
      run('add', '-A');
      const args = ['commit', '-q', '-m', subject];
      if (body) args.push('-m', body);
      run(...args);
      return run('rev-parse', 'HEAD').trim();
    },
    tag(name) {
      run('tag', '-a', name, '-m', name);
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
