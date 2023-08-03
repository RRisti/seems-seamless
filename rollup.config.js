import terser from '@rollup/plugin-terser';

export default {
    input: 'src/js/index.js',
    output: [
        {
            file: 'dist/index.js',
            format: 'iife',
            name: 'version',
            plugins: [terser()],
        },
    ],
};
