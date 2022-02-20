import { BatchCluster as _bc, path as _path } from './deps.ts';
import { times } from './Array.ts';
import { ExifDate } from './ExifDate.ts';
import { ExifDateTime } from './ExifDateTime.ts';
import { ExifTime } from './ExifTime.ts';
import { DefaultMaxProcs, ExifTool, exiftool, WriteTags } from './ExifTool.ts';
import { parseJSON } from './JSON.ts';
import { keys } from './Object.ts';
import { leftPad } from "./String.ts"
import { Tags } from './Tags.ts';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	isWin32,
	it,
	testImg,
} from './_chai.spec.ts';

const BatchCluster = _bc.BatchCluster;
const __filename = _path.fromFileUrl(import.meta.url);
const __dirname = _path.dirname(__filename);

function normalize(tagNames: string[]): string[] {
	return tagNames
		.filter((i) => i !== 'FileInodeChangeDate' && i !== 'FileCreateDate')
		.sort();
}

function posixPath(path: string) {
	return path.split(_path.sep).join('/');
}

describe('ExifTool', function () {
	// after(async () => await exiftool.end());
	// @todo check on this later
	// this.timeout(15000)
	// this.slow(100)

	const truncated = _path.join(__dirname, '..', 'test', 'truncated.jpg');
	const noexif = _path.join(__dirname, '..', 'test', 'noexif.jpg');
	const img = _path.join(__dirname, '..', 'test', 'img.jpg');
	const img2 = _path.join(__dirname, '..', 'test', 'ExifTool.jpg');
	const img3 = _path.join(__dirname, '..', 'test', 'with_thumb.jpg');
	const nonEnglishImg = _path.join(__dirname, '..', 'test', '中文.jpg');

	// const packageJson = require("../package.json")

	function expectedExiftoolVersion(flavor: 'exe' | 'pl' = 'pl'): string {
		const vendorVersion = '12.39.0';
		// @todo check this stuff
		// const vendorVersion: string =
		//   packageJson.optionalDependencies["exiftool-vendored." + flavor]
		// // Everyone's a monster here:
		// // * semver is pissy about 0-padded version numbers (srsly, it's ok)
		// // * exiftool bumps the major version because minor hit 99</rant>

		// // vendorVersion might have a ^ or ~ or something else as a prefix, so get
		// // rid of that:
		return vendorVersion
		  .replace(/^[^.0-9]+/, "")
		  .split(".")
		  .slice(0, 2)
		  .map((ea) => leftPad(ea, 2, "0"))
		  .join(".")
	}

	const ignoreShebangs = [];
	if (exiftool.options.ignoreShebang) {
		// If the default is true, we can only test true.
		ignoreShebangs.push(true);
	} else {
		ignoreShebangs.push(false);
		if (!isWin32()) ignoreShebangs.push(true);
	}

	for (const ignoreShebang of [false]) {
		describe('exiftool({ ignoreShebang: ' + ignoreShebang + ' })', () => {
			let et: ExifTool;

			beforeEach(
				() => (et = new ExifTool({
					maxProcs: 2,
					ignoreShebang,
					logger: () => {
						return {
							trace: console.trace,
							debug: console.debug,
							info: console.info,
							warn: console.warn,
							error: console.error
						}
					}
				})),
			);
			afterEach(async () => {
				await et.end();
				await new Promise((resolve) => setTimeout(resolve, 500));
			});

			// it('returns expected results for a given file with non-english filename', function () {
			// 	// @todo check on this later
			// 	// this.slow(500)
			// 	return expect(
			// 		et.read(nonEnglishImg).then((tags) => tags.Model),
			// 	).to.eventually.eql('iPhone 7 Plus');
			// });

			// it('renders Orientation as numbers', async () => {
			// 	const tags = await et.read(img);
			// 	expect(tags.Orientation).to.eql(1);
			// 	return;
			// });

			it('round-trips', async () => {
				const t = await exiftool.read(img3);

				function assert(ea: Tags) {
					expect((ea.SubSecCreateDate as any).constructor).to.eql(
						ExifDateTime,
					);
					expect((ea.GPSTimeStamp as any).constructor).to.eql(ExifTime);
					expect((ea.GPSDateStamp as any).constructor).to.eql(ExifDate);

					expect({
						datetime: ea.SubSecCreateDate?.toString(),
						time: ea.GPSTimeStamp?.toString(),
						date: ea.GPSDateStamp?.toString(),
					}).to.eql({
						datetime: '2017-12-22T17:08:35.363-08:00',
						time: '01:08:22',
						date: '2017-12-23',
					});

					// Verify that all primitive types are as expected:
					expect(ea.ISO).to.eql(60);
					expect(ea.FNumber).to.be.closeTo(2.0, 0.01);
					expect(ea.Contrast).to.eql('Normal');
					expect(ea.Keywords).to.eql(['red fish', 'blue fish']);
				}

				assert(t);

				const t2 = parseJSON(JSON.stringify(t));
				assert(t2);

				expect(t2.SubSecCreateDate).to.eql(t.SubSecCreateDate);
				expect(t2.GPSDateTime).to.eql(t.GPSDateTime);
				expect(t2.GPSDateStamp).to.eql(t.GPSDateStamp);
				await exiftool.end();
				await new Promise((resolve) => setTimeout(resolve, 1000));
			});

			// it('extracts OriginalImage{Width,Height} if [] is provided to override the -fast option', async () => {
			// 	return expect(await et.read(img2, [])).to.containSubset({
			// 		Keywords: 'jambalaya',
			// 		ImageHeight: 8,
			// 		ImageWidth: 8,
			// 		OriginalImageHeight: 16,
			// 		OriginalImageWidth: 16,
			// 	});
			// });
		});
	}
});

// import {assert, fail, assertEquals} from "https://deno.land/std/testing/asserts.ts";

// function expectedExiftoolVersion(flavor: 'exe' | 'pl' = 'pl'): string {
// 	const vendorVersion = '12.39.0';
// 	// @todo check this stuff
// 	// const vendorVersion: string =
// 	//   packageJson.optionalDependencies["exiftool-vendored." + flavor]
// 	// // Everyone's a monster here:
// 	// // * semver is pissy about 0-padded version numbers (srsly, it's ok)
// 	// // * exiftool bumps the major version because minor hit 99</rant>

// 	// // vendorVersion might have a ^ or ~ or something else as a prefix, so get
// 	// // rid of that:
// 	return vendorVersion
// 	  .replace(/^[^.0-9]+/, "")
// 	  .split(".")
// 	  .slice(0, 2)
// 	  .map((ea) => leftPad(ea, 2, "0"))
// 	  .join(".")
// }

// Deno.test({
// 	name: 'returns the correct version',
// 	async fn() {
// 		const et = new ExifTool({
// 			maxProcs: 2,
// 			ignoreShebang: false,
// 			logger: () => {
// 				return {
// 					trace: console.trace,
// 					debug: console.debug,
// 					info: console.info,
// 					warn: console.warn,
// 					error: console.error
// 				}
// 			}
// 		})
// 		const version = await et.version();

// 		console.log('xxxx', version);

// 		assertEquals(version, expectedExiftoolVersion());

// 		await et.end();
// 		const metrics = Deno.metrics();
// 		console.log('xxxx', {
// 			...metrics,
// 			ops: Object.keys(metrics.ops).reduce((acc: any, key) => {
// 				const op = metrics.ops[key];

// 				if (op.opsCompleted !== op.opsDispatched) {
// 					acc[key] = op;
// 				}
// 				return acc;
// 			}, {})
// 		});
// 		console.log('xxxx', et.ended);
// 	}
// });
