#!/usr/bin/env node
// Side-project native validation: unavailable infrastructure is a documented skip.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function infrastructureFailure(output) {
  return [
    ['Android SDK unavailable', /SDK location not found|Failed to find Platform SDK|Failed to find Build Tools|License for package .* not accepted/i],
    ['Java unavailable', /JAVA_HOME is set to an invalid directory|Unable to locate a Java Runtime|No Java installation found|Cannot find a Java installation.*matching/i],
    ['Native configuration unavailable', /File google-services\.json is missing|GoogleService-Info\.plist.*(?:missing|not found)/i],
    ['Native device unavailable', /No connected devices|No online devices found|Can't find service: package|Unable to find a destination matching/i],
    ['Native dependency unavailable', /Could not (?:GET|HEAD) ['"]https?:|UnknownHostException|Could not resolve host|No cached version of .* available for offline mode/i],
  ].find(([, pattern]) => pattern.test(output))?.[0] ?? null;
}

export function prerequisites(platform, env = process.env) {
  const run = (cmd, args) => spawnSync(cmd, args, {env, timeout: 10000, encoding: 'utf8'});
  if (platform === 'android') {
    const javaHome = env.JAVA_HOME;
    const java = javaHome ? path.join(javaHome, 'bin/java') : 'java';
    if (run(java, ['-version']).status !== 0) return 'Java unavailable';
    const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library/Android/sdk');
    if (run(process.execPath, ['-e', 'require("fs").accessSync(process.argv[1])', sdk]).status !== 0) return 'Android SDK unavailable';
  } else if (platform === 'ios' || platform === 'macos') {
    if (run('xcrun', ['--find', platform === 'ios' ? 'simctl' : 'swift']).status !== 0 || run('xcodebuild', ['-version']).status !== 0) return 'Xcode unavailable';
  } else throw new Error('Expected --platform android, ios or macos');
  return null;
}

async function main(args) {
  const separator = args.indexOf('--');
  const options = separator < 0 ? args : args.slice(0, separator);
  const platform = options[options.indexOf('--platform') + 1];
  if (!options.includes('--platform')) throw new Error('Expected --platform android|ios|macos [--probe] [--require-file path] -- command [args]');
  let reason = prerequisites(platform);
  if (!reason && options.includes('--require-file')) {
    const file = options[options.indexOf('--require-file') + 1];
    if (!file) throw new Error('Expected a path after --require-file');
    if (!(await fs.stat(file).catch(() => null))) reason = 'Required native configuration file unavailable';
  }
  const record = async (status, reason, exitCode = null) => {
    await fs.mkdir('.symphony', {recursive: true});
    const entry = {at: new Date().toISOString(), platform, status, reason, exit_code: exitCode};
    await fs.appendFile('.symphony/native-checks.jsonl', JSON.stringify(entry) + '\n', {mode: 0o600});
    console.log(`Native ${platform}: ${status}${reason ? ` (${reason})` : ''}. Include this result in the PR verification section.`);
  };
  if (reason) { await record('skipped', reason); return; }
  if (options.includes('--probe')) { await record('available', null); return; }
  const command = args.slice(separator + 1);
  if (separator < 0 || !command.length) throw new Error('Expected a native check command after --');
  let output = '';
  const child = spawn(command[0], command.slice(1), {stdio: ['ignore', 'pipe', 'pipe']});
  for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', bytes => {
    destination.write(bytes); output = (output + bytes.toString()).slice(-131072);
  });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code, signal) => resolve(signal ? 1 : code ?? 1)); });
  reason = code ? infrastructureFailure(output) : null;
  await record(reason ? 'skipped' : code ? 'failed' : 'passed', reason, code);
  process.exitCode = reason ? 0 : code;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
