import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, 'dist/index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: path.join(__dirname, 'dist/index.js'),
  allowOverwrite: true,
  external: ['better-sqlite3'],
  alias: {
    '@clux-cli/core': path.join(__dirname, '..', 'core', 'dist', 'index.js'),
    '@clux-cli/web/dist/server': path.join(__dirname, '..', 'web', 'dist', 'server.js'),
    '@clux-cli/web': path.join(__dirname, '..', 'web', 'dist', 'server.js'),
  },
});
