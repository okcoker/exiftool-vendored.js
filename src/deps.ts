import * as path from 'https://deno.land/std@0.122.0/path/mod.ts';
import { walk, walkSync } from 'https://deno.land/std@0.122.0/fs/mod.ts';
export * as fs from 'https://deno.land/std@0.122.0/node/fs.ts';
export * as ProgressBar from 'https://cdn.skypack.dev/progress@2.0.3';
export * as luxon from 'https://cdn.skypack.dev/luxon@2.3.0?dts';
export * as BatchCluster from '../../batch-cluster/mod.ts';
export * as he from 'https://cdn.skypack.dev/he@1.2.0';
export { default as tzlookup } from 'https://cdn.skypack.dev/tz-lookup@6.1.25';
export { Buffer } from 'https://deno.land/std@0.122.0/node/buffer.ts';
import * as assert from 'https://cdn.skypack.dev/assert@2.0.0?dts';
export { crypto } from 'https://deno.land/std@0.122.0/crypto/mod.ts';
export { encode } from 'https://deno.land/std@0.122.0/encoding/hex.ts';
export { ensureDir as mkdirp } from 'https://deno.land/std@0.122.0/fs/mod.ts';
export { copyFile } from 'https://deno.land/std@0.122.0/node/fs/promises.ts';

export { assert, path };

export const getOSTempDir = () =>
    Deno.env.get('TMPDIR') || Deno.env.get('TMP') || Deno.env.get('TEMP') ||
    '/tmp';

export async function glob(root: string, pattern: string) {
    const fullPath = path.join(root, pattern);
    const regex = path.globToRegExp(fullPath);
    const paths: string[] = [];

    for await (const entry of walk(root)) {
        if (entry.path.match(regex)) {
            paths.push(entry.path);
        }
    }

    return paths;
}

export function globSync(root: string, pattern: string) {
    const fullPath = path.join(root, pattern);
    const regex = path.globToRegExp(fullPath);
    const paths: string[] = [];

    for (const entry of walkSync(root)) {
        if (entry.path.match(regex)) {
            paths.push(entry.path);
        }
    }

    return paths;
}
