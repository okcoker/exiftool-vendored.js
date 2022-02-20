import { Buffer, path } from './deps.ts';
import { ExifToolTask } from './ExifToolTask.ts';
import { Maybe } from './Maybe.ts';
import { notBlank } from './String.ts';

/**
 * Task that returns an error string (to prevent retries), or undefined if
 * everything seems to have worked.
 */
export class BinaryToBufferTask extends ExifToolTask<Buffer | Error> {
    private constructor(readonly tagname: string, args: string[]) {
        super(args);
    }

    static for(tagname: string, imgSrc: string): BinaryToBufferTask {
        // NOTE TO FUTURE ME: we don't need to escape these arguments, because
        // ExifTool separates them via newlines.
        const args = ['-json', '-b', '-' + tagname, path.resolve(imgSrc)];
        return new BinaryToBufferTask(tagname, args);
    }

    parse(data: string, err?: Error): Buffer | Error {
        try {
            const obj = JSON.parse(data)?.[0];
            // did they get the casing right?
            {
                const result = decode(obj[this.tagname]);
                if (result != null) return result;
            } // hmm, incorrect casing. Check the other keys.
            for (const k of Object.keys(obj)) {
                if (k.toLowerCase() === this.tagname.toLowerCase()) {
                    const result = decode(obj[k]);
                    if (result != null) return result;
                }
            }
        } catch (caught) {
            err ??= notBlank(data)
                ? new Error(data)
                : caught instanceof Error
                ? caught
                : new Error(String(caught));
        }
        return err ?? new Error(this.tagname + ' not found');
    }
}

const B64Prefix = 'base64:';

function decode(data: Maybe<string>): Maybe<Buffer> {
    return data == null || !data.startsWith(B64Prefix)
        ? undefined
        : Buffer.from(data.substring(B64Prefix.length), 'base64');
}
