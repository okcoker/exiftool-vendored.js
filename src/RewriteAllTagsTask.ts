import { path as _path } from './deps.ts';
import { compact } from './Array.ts';
import { ExifToolTask } from './ExifToolTask.ts';

export class RewriteAllTagsTask extends ExifToolTask<void> {
    private constructor(args: string[]) {
        super(args);
    }

    static for(
        imgSrc: string,
        imgDest: string,
        allowMakerNoteRepair: boolean,
    ): RewriteAllTagsTask {
        // -all= -tagsfromfile @ -all:all -unsafe -icc_profile bad.jpg

        const args = compact([
            '-all=',
            '-tagsfromfile',
            '@',
            '-all:all',
            '-unsafe',
            '-icc_profile',
            allowMakerNoteRepair ? '-F' : undefined,
            _path.resolve(imgSrc),
            '-out',
            _path.resolve(imgDest),
        ]);
        return new RewriteAllTagsTask(args);
    }

    parse(data: string, error?: Error): void {
        if (error != null) {
            const str = String(error);
            // Ignore warnings:
            if (str.match(/\berror\b/i) != null && !str.match(/\bwarning\b/i)) {
                throw error;
            }
        }
        if (null == data.match(/^\s*1 image files creat/i)) {
            throw (
                error ??
                    new Error(
                        data.trim().split('\n')[0] ??
                            'Missing expected status message',
                    )
            );
        }
    }
}
