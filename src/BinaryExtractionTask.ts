import { path } from './deps.ts';
import { ExifToolTask } from './ExifToolTask.ts';
import { Maybe } from './Maybe.ts';
import { toS } from './String.ts';

const StdoutRe = /\b(\d+) output files? created/i;

/**
 * Task that returns an error string (to prevent retries), or undefined if
 * everything seems to have worked.
 */
export class BinaryExtractionTask extends ExifToolTask<Maybe<string>> {
	private constructor(args: string[]) {
		super(args);
	}

	static for(
		tagname: string,
		imgSrc: string,
		imgDest: string,
	): BinaryExtractionTask {
		const args = [
			'-b',
			'-' + tagname,
			path.resolve(imgSrc),
			'-w',
			// The %0f prevents shell escaping. See
			// https://exiftool.org/exiftool_pod.html#w-EXT-or-FMT--textOut
			'%0f' + path.resolve(imgDest),
		];
		return new BinaryExtractionTask(args);
	}

	parse(stdout: string, err?: Error): Maybe<string> {
		const s = toS(stdout).trim();
		const m = StdoutRe.exec(s);
		if (err != null) {
			throw err;
		} else if (m == null) {
			throw new Error(
				'Missing expected status message (got ' + stdout + ')',
			);
		} else if (m[1] === '1') {
			return;
		} else {
			// Don't retry: the binary payload is missing, and retrying won't fix that.
			return s;
		}
	}
}
