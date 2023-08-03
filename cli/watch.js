const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const cwd = path.resolve(__dirname, '..');
let isInitialScanReady = false;

const mapping = {
    js: 'build:js',
    pug: 'build:html',
    scss: 'build:css',
};

chokidar
    .watch('src/.')
    .on('ready', () => {
        isInitialScanReady = true;
    })
    .on('all', (name, file) => {
        if (!isInitialScanReady) return;

        const extension = file.split('.').pop();
        const command = mapping[extension];

        if (command) {
            console.log({ command });
            spawn('yarn', [command], { cwd });
        }
    });
