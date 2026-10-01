#!/usr/bin/env node
'use strict';

// Funkin.jsと同じディレクトリで実行するNode.jsセットアップツール。
// GitのHTTPS transportを使って公式リポジトリを取得します。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const ENGINE_DIR = path.join(ROOT, 'engines');
const PSYCH_DIR = path.join(ENGINE_DIR, 'psych-engine');
const KADE_DIR = path.join(ENGINE_DIR, 'kade-engine');
const MOD_NAME = 'ZeroFunkin';
const SONG_NAME = 'zero-song';

const PSYCH_REPO = 'https://github.com/ShadowMario/FNF-PsychEngine.git';
const KADE_REPO = 'https://github.com/KadeDev/Kade-Engine.git';

function run(command, args, cwd = ROOT) {
  console.log(`[run] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch (_) { return false; }
}

function cloneOrUpdate(url, destination, branch) {
  if (exists(path.join(destination, '.git'))) {
    console.log(`[update] ${destination}`);
    run('git', ['-C', destination, 'fetch', '--depth=1', 'origin']);
    if (branch) {
      const checkout = spawnSync('git', ['-C', destination, 'checkout', '-B', branch, `origin/${branch}`], { stdio: 'inherit' });
      if (checkout.status !== 0) console.log(`[info] ${branch} branch was not found; using fetched HEAD.`);
    }
    run('git', ['-C', destination, 'reset', '--hard', 'FETCH_HEAD']);
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (branch) {
    const result = spawnSync('git', ['clone', '--depth=1', '--branch', branch, url, destination], { stdio: 'inherit' });
    if (result.status === 0) return;
    fs.rmSync(destination, { recursive: true, force: true });
    console.log(`[info] ${branch} branch was not found; retrying default branch.`);
  }
  run('git', ['clone', '--depth=1', url, destination]);
}

function copyAdapter(source, destination) {
  if (!exists(source)) throw new Error(`File not found: ${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`[copy] ${source} -> ${destination}`);
}

function main() {
  if (!exists(path.join(ROOT, 'Funkin.js'))) {
    console.log('[warning] Funkin.js is not in this directory; continuing anyway.');
  }
  if (!exists(path.join(ROOT, 'FunkinJsPsychAdapter.lua')) || !exists(path.join(ROOT, 'FunkinJsKadeAdapter.hx'))) {
    throw new Error('FunkinJsPsychAdapter.lua and FunkinJsKadeAdapter.hx must be beside this script.');
  }

  fs.mkdirSync(ENGINE_DIR, { recursive: true });
  cloneOrUpdate(PSYCH_REPO, PSYCH_DIR, 'main');
  cloneOrUpdate(KADE_REPO, KADE_DIR, 'stable');

  copyAdapter(
    path.join(ROOT, 'FunkinJsPsychAdapter.lua'),
    path.join(PSYCH_DIR, 'mods', MOD_NAME, 'data', SONG_NAME, 'script.lua')
  );
  copyAdapter(
    path.join(ROOT, 'FunkinJsKadeAdapter.hx'),
    path.join(KADE_DIR, 'source', 'states', 'FunkinJsKadeAdapter.hx')
  );

  console.log('\n完了しました。');
  console.log(`Psych Engine: ${path.join(PSYCH_DIR, 'mods', MOD_NAME, 'data', SONG_NAME, 'script.lua')}`);
  console.log(`Kade Engine:  ${path.join(KADE_DIR, 'source', 'states', 'FunkinJsKadeAdapter.hx')}`);
  console.log('取得元は公式GitHubリポジトリです。各エンジンの依存関係とビルドは別途必要です。');
}

try {
  main();
} catch (error) {
  console.error(`\n[error] ${error.message}`);
  process.exitCode = 1;
}
