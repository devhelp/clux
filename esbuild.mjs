import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
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
});

fs.cpSync(
  path.join(__dirname, 'public'),
  path.join(__dirname, 'dist/public'),
  { recursive: true },
);
