import { blank } from './String.ts';

export async function isFileEmpty(path: string): Promise<boolean> {
    if (blank(path)) {
        throw new Error('isFileEmpty(): blank path');
    }

    try {
        const fileInfo = await Deno.stat(path);
        // @ts-ignore size does exist...
        return !fileInfo || fileInfo.size === 0;
    } catch (err: any) {
        if (err.code === 'ENOENT') return true;
        else throw err;
    }
}
