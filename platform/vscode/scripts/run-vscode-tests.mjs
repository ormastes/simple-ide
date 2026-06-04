import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const command = process.platform === 'win32' ? 'vscode-test.cmd' : 'vscode-test';
const args = process.argv.slice(2);
const child = spawn(command, args, {
    detached: process.platform !== 'win32',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
});
const testProcessMarker = `${process.cwd()}/.vscode-test`;

let sawPassingSummary = false;
let sawFailureSummary = false;
let settled = false;
let lingerTimer;

function terminateTestGroup() {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    try {
        if (process.platform === 'win32') {
            child.kill('SIGTERM');
        } else {
            process.kill(-child.pid, 'SIGTERM');
        }
    } catch {
        child.kill('SIGTERM');
    }
}

function terminateLingeringTestProcesses() {
    if (process.platform === 'win32') {
        return;
    }
    const result = spawnSync('pgrep', ['-f', testProcessMarker], { encoding: 'utf8' });
    for (const rawPid of result.stdout.split(/\s+/)) {
        const pid = Number(rawPid);
        if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
            continue;
        }
        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            // Process already exited.
        }
    }
}

function finish(code) {
    if (settled) {
        return;
    }
    settled = true;
    if (lingerTimer) {
        clearTimeout(lingerTimer);
    }
    process.exitCode = code;
}

function observeOutput(chunk) {
    const text = chunk.toString();
    if (/\b\d+\s+passing\b/.test(text)) {
        sawPassingSummary = true;
        if (!lingerTimer) {
            lingerTimer = setTimeout(() => {
                if (sawPassingSummary && !sawFailureSummary) {
                    terminateTestGroup();
                    terminateLingeringTestProcesses();
                    finish(0);
                }
            }, 3000);
        }
    }
    if (/\b\d+\s+failing\b/.test(text) || /\btest failed\b/i.test(text)) {
        sawFailureSummary = true;
    }
}

child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    observeOutput(chunk);
});
child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    observeOutput(chunk);
});
child.on('error', (error) => {
    console.error(error.message);
    finish(1);
});
child.on('exit', (code, signal) => {
    if (sawPassingSummary && !sawFailureSummary) {
        finish(0);
        return;
    }
    if (signal) {
        finish(1);
        return;
    }
    finish(code ?? 1);
});
