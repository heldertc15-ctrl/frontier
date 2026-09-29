import fs from 'node:fs';
import path from 'node:path';

for (const directoryName of ['dist', 'dist-server']) {
  const target = path.resolve(process.cwd(), directoryName);
  fs.rmSync(target, { force: true, recursive: true });
}
