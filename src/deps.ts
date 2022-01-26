export * as path from "https://deno.land/std@0.122.0/path/mod.ts";
export * as fs from "https://deno.land/std@0.122.0/node/fs.ts";
export * as ProgressBar from "https://cdn.skypack.dev/progress@2.0.3";
export * as luxon from "https://cdn.skypack.dev/luxon@2.3.0";
export * as BatchCluster from "https://cdn.skypack.dev/batch-cluster@9.0.1";
// https://stackoverflow.com/questions/61813646/whats-deno-equivalent-of-node-js-buffer-fromstring
export class Buffer {
    static from(str: string, encoding = 'hex') {
        if (encoding === 'base64') {
            return btoa(str);
        }

        const encoder = new TextEncoder()
        return encoder.encode(str);
    }
}

export const getOSTempDir = () => Deno.env.get('TMPDIR') || Deno.env.get('TMP') || Deno.env.get('TEMP') || '/tmp';
