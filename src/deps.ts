export * as path from "https://deno.land/std@0.122.0/path/mod.ts";
export * as fs from "https://deno.land/std@0.122.0/node/fs.ts";

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
