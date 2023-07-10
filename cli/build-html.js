const fs = require('fs');
const path = require('path');
const pug = require('pug');

const compiler = pug.compileFile(path.resolve(__dirname, '../src/index.pug'), {});

const data = compiler({
    title: 'Seems seamless',
});

fs.writeFileSync(path.resolve(__dirname, '../dist/index.html'), data);
