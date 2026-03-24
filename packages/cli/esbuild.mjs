import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const workspaceResolve = {
  name: 'workspace-resolve',
  setup(build) {
    build.onResolve({ filter: /^@clux-cli\// }, (args) => {
      if (args.path === '@clux-cli/core') {
        return { path: path.resolve(__dirname, '../core/dist/index.js') };
      }
      if (
        args.path === '@clux-cli/web' ||
        args.path === '@clux-cli/web/dist/server'
      ) {
        return { path: path.resolve(__dirname, '../web/dist/server.js') };
      }
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(__dirname, 'dist/index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: path.join(__dirname, 'dist/index.js'),
  allowOverwrite: true,
  external: ['better-sqlite3'],
  plugins: [workspaceResolve],
});

// Copy web public assets into CLI dist so they're available at runtime
const srcPublic = path.resolve(__dirname, '../web/dist/public');
const destPublic = path.resolve(__dirname, 'dist/public');
fs.cpSync(srcPublic, destPublic, { recursive: true });
