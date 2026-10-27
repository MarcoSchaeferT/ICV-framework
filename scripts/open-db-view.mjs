import { spawn } from 'node:child_process';

const url = 'http://127.0.0.1:8081';

const opener = process.platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
        ? { command: 'open', args: [url] }
        : { command: 'xdg-open', args: [url] };

const child = spawn(opener.command, opener.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
});

child.on('error', () => {
    // The URL below remains available when no desktop opener is installed.
});
child.unref();

console.log(`Database viewer: ${url}`);
