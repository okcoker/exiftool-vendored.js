import { copyFile, getOSTempDir, mkdirp, path } from './deps.ts';
import { ExifDateTime } from './ExifDateTime.ts';
import { ExifTool, exiftool } from './ExifTool.ts';
import { ReadTask } from './ReadTask.ts';
import { Tags } from './Tags.ts';
import {
	afterAll as after,
	beforeAll as before,
	describe,
	expect,
	isWin32,
	it,
	testDir,
} from './_chai.spec.ts';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

function parse(tags: any, err?: Error): Tags {
	const tt = ReadTask.for('/tmp/example.jpg', []);
	tags.SourceFile = '/tmp/example.jpg';
	const json = JSON.stringify([tags]);
	return tt['parse'](json, err);
}

describe('ReadTask', () => {
	after(() => exiftool.end());

	describe('Lat/Lon parsing', () => {
		/* Example:
    $ exiftool -j -coordFormat '%.8f' -fast ../test-images/important/Apple_iPhone7Plus.jpg | grep itude
    "GPSLatitudeRef": "North",
    "GPSLongitudeRef": "East",
    "GPSAltitudeRef": "Above Sea Level",
    "GPSAltitude": "73 m Above Sea Level",
    "GPSLatitude": 22.33543889,
    "GPSLongitude": 114.16401667,
   */
		it('N lat is positive', () => {
			expect(
				parse({ GPSLatitude: 22.33543889, GPSLatitudeRef: 'N' })
					.GPSLatitude,
			).to.be.closeTo(22.33543889, 0.00001);
		});
		it('S lat is negative', () => {
			expect(
				parse({ GPSLatitude: 33.84842123, GPSLatitudeRef: 'S' })
					.GPSLatitude,
			).to.be.closeTo(-33.84842123, 0.00001);
		});
		it('E lon is positive', () => {
			expect(
				parse({ GPSLongitude: 114.16401667, GPSLongitudeRef: 'E' })
					.GPSLongitude,
			).to.be.closeTo(114.16401667, 0.00001);
		});
		it('W lon is negative', () => {
			expect(
				parse({ GPSLongitude: 122.4406148, GPSLongitudeRef: 'W' })
					.GPSLongitude,
			).to.be.closeTo(-122.4406148, 0.00001);
		});
		it('parses lat lon even if timezone is given', () => {
			expect(
				parse({
					GPSLongitude: 122.4406148,
					GPSLongitudeRef: 'West',
					OffsetTime: '+02:00',
				}).GPSLongitude,
			).to.be.closeTo(-122.4406148, 0.00001);
		});

		it('extracts problematic GPSDateTime', async () => {
			const t = await exiftool.read(path.join(testDir, 'nexus5x.jpg'));
			expect(t).to.containSubset({
				MIMEType: 'image/jpeg',
				Make: 'LGE',
				Model: 'Nexus 5X',
				ImageWidth: 16,
				ImageHeight: 16,
				tz: 'Europe/Zurich',
				tzSource: 'from Lat/Lon',
			});

			const gpsdt = t.GPSDateTime as any as ExifDateTime;
			expect(gpsdt.toString()).to.eql('2016-07-19T10:00:24.000Z');
			expect(gpsdt.rawValue).to.eql('2016:07:19 10:00:24Z');
			expect(gpsdt.zoneName).to.eql('UTC');
		});

		describe('without *Ref fields', () => {
			for (const latSign of [1, -1]) {
				for (const lonSign of [1, -1]) {
					const input = {
						GPSLatitude: latSign * 34.4,
						GPSLongitude: lonSign * 119.8,
					};
					it(`extracts (${JSON.stringify(input)})`, () => {
						expect(parse(input)).to.containSubset(input);
					});
				}
			}
		});
	});

	describe('Time zone extraction', () => {
		it('finds singular positive TimeZoneOffset and sets accordingly', () => {
			const t = parse({
				TimeZoneOffset: 9,
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(9 * 60);
		});

		it('finds positive array TimeZoneOffset and sets accordingly', () => {
			const t = parse({
				TimeZoneOffset: [9, 8],
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(9 * 60);
		});

		it('finds zulu TimeZoneOffset and sets accordingly', () => {
			const t = parse({
				TimeZoneOffset: 0,
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(0);
		});

		it('finds negative TimeZoneOffset in array and sets accordingly', () => {
			const t = parse({
				TimeZoneOffset: [-4],
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(-4 * 60);
		});

		it('respects positive HH:MM OffsetTime', () => {
			const t = parse({
				OffsetTime: '+02:30',
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(
				2 * 60 + 30,
			);
		});

		it('respects positive HH OffsetTime', () => {
			const t = parse({
				OffsetTime: '+07',
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(7 * 60);
		});

		it('respects negative HH:MM OffsetTime', () => {
			const t = parse({
				OffsetTime: '-06:30',
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(
				-(6 * 60 + 30),
			);
		});

		it('respects negative HH OffsetTime', () => {
			const t = parse({
				OffsetTime: '-9',
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(-9 * 60);
			expect(t.tz).to.eql('UTC-09');
			expect(t.tzSource).to.eql(
				'offsetMinutesToZoneName from OffsetTime',
			);
		});

		it('determines timezone offset from GPS (specifically, Landscape Arch!)', () => {
			const t = parse({
				GPSLatitude: 38.791121,
				GPSLatitudeRef: 'North',
				GPSLongitude: 109.606407,
				GPSLongitudeRef: 'West',
				DateTimeOriginal: '2016:08:12 13:28:50',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(-6 * 60);
			expect(t.tz).to.eql('America/Denver');
			expect(t.tzSource).to.eql('from Lat/Lon');
		});

		it('uses GPSDateTime and DateTimeOriginal and sets accordingly for -7', () => {
			const t = parse({
				DateTimeOriginal: '2016:10:19 11:15:14',
				GPSDateTime: '2016:10:19 18:15:12',
				DateTimeCreated: '2016:10:19 11:15:14',
			});
			expect((t.DateTimeOriginal as ExifDateTime).tzoffsetMinutes).to.eql(
				-7 * 60,
			);
			expect((t.DateTimeCreated as ExifDateTime).tzoffsetMinutes).to.eql(
				-7 * 60,
			);
			expect(t.tz).to.eql('UTC-07');
			expect(t.tzSource).to.eql(
				'offset between DateTimeOriginal and GPSDateTime',
			);
		});

		it('uses DateTimeUTC and DateTimeOriginal and sets accordingly for +8', () => {
			const t = parse({
				DateTimeOriginal: '2016:10:19 11:15:14',
				DateTimeUTC: '2016:10:19 03:15:12',
				DateTimeCreated: '2016:10:19 11:15:14',
			});
			expect((t.DateTimeOriginal as ExifDateTime).tzoffsetMinutes).to.eql(
				8 * 60,
			);
			expect((t.DateTimeCreated as ExifDateTime).tzoffsetMinutes).to.eql(
				8 * 60,
			);
			expect(t.tz).to.eql('UTC+08');
			expect(t.tzSource).to.eql(
				'offset between DateTimeOriginal and DateTimeUTC',
			);
		});

		it('uses DateTimeUTC and DateTimeOriginal and sets accordingly for +5:30', () => {
			const t = parse({
				DateTimeOriginal: '2018:10:19 11:15:14',
				DateTimeUTC: '2018:10:19 05:45:12',
				DateTimeCreated: '2018:10:19 11:15:14',
			});
			expect((t.DateTimeOriginal as ExifDateTime).tzoffsetMinutes).to.eql(
				5.5 * 60,
			);
			expect((t.DateTimeCreated as ExifDateTime).tzoffsetMinutes).to.eql(
				5.5 * 60,
			);
			expect(t.tz).to.eql('UTC+05:30');
			expect(t.tzSource).to.eql(
				'offset between DateTimeOriginal and DateTimeUTC',
			);
		});

		it('renders SubSecDateTimeOriginal for -8', () => {
			const input = {
				DateTimeOriginal: '2016:12:13 09:05:27',
				GPSDateTime: '2016:12:13 17:05:25Z',
				SubSecDateTimeOriginal: '2016:12:13 09:05:27.12038200',
			};
			const t = parse(input);
			{
				const edt = t.SubSecDateTimeOriginal as ExifDateTime;
				expect(edt.rawValue).to.eql(input.SubSecDateTimeOriginal);
				expect(edt.toISOString({ includeOffset: true })).to.eql(
					'2016-12-13T09:05:27.120-08:00',
				);
			}
			{
				const edt = t.GPSDateTime as ExifDateTime;
				expect(edt.rawValue).to.eql(input.GPSDateTime);
				expect(edt.toISOString({ includeOffset: true })).to.eql(
					'2016-12-13T17:05:25.000Z',
				);
			}
			expect(t.tz).to.eql('UTC-08');
			expect(t.tzSource).to.eql(
				'offset between SubSecDateTimeOriginal and GPSDateTime',
			);
		});

		it('skips invalid timestamps', () => {
			const t = parse({
				DateTimeOriginal: '2016:08:12 13:28:50',
				GPSDateTime: 'not a timestamp',
			});
			expect((t.DateTimeOriginal as any).tzoffsetMinutes).to.eql(
				undefined,
			);
			expect(t.tz).to.eql(undefined);
			expect(t.tzSource).to.eql(undefined);
		});
	});

	describe('SubSecDateTimeOriginal', () => {
		it('extracts datetimestamp with millis', () => {
			const t = parse({
				SubSecDateTimeOriginal: '2016:10:19 11:15:14.437831',
			})
				.SubSecDateTimeOriginal as ExifDateTime;
			expect(t.year).to.eql(2016);
			expect(t.month).to.eql(10);
			expect(t.day).to.eql(19);
			expect(t.hour).to.eql(11);
			expect(t.minute).to.eql(15);
			expect(t.second).to.eql(14);
			expect(t.tzoffsetMinutes).to.eql(undefined);
			expect(t.millisecond).to.eql(437);
			const d = t.toDate();
			expect(d.getFullYear()).to.eql(2016);
			expect(d.getMonth()).to.eql(10 - 1);
			expect(d.getDate()).to.eql(19);
			expect(d.getHours()).to.eql(11);
			expect(d.getMinutes()).to.eql(15);
			expect(d.getSeconds()).to.eql(14);

			expect(d.getMilliseconds()).to.eql(437); // Javascript Date doesn't do fractional millis.
		});
	});
	describe('EXIFTOOL_HOME', () => {
		let et: ExifTool;
		before(
			() => (et = new ExifTool({
				exiftoolEnv: {
					EXIFTOOL_HOME: path.resolve(__dirname, '..', 'test'),
				},
			})),
		);
		after(() => et.end());
		it('returns the new custom tag', async () => {
			const t: any = await et.read('./test/pixel.jpg');

			// This is a non-standard tag, added by the custom user configuration:
			expect(t.UppercaseBaseName).to.eql('PIXEL');
		});
	});

	describe('quotes in filenames', () => {
		const base = isWin32() ? `it's a file.jpg` : `it's a "file".jpg`;
		it('reads from ' + base, async () => {
			const tmp = path.join(getOSTempDir(), base);
			await mkdirp(getOSTempDir());
			await copyFile('./test/quotes.jpg', tmp);
			const t = await exiftool.read(tmp);
			expect(t.FileName).to.eql(base);
			expect(t.MIMEType).to.eql('image/jpeg');
			expect(t.ImageDescription).to.eql(
				'image description for quotes test',
			);
			expect(t.Keywords).to.eql('quotes');
			expect(t.DateTimeOriginal?.toString()?.split(/000/)[0]).to.eql(
				'2016-08-12T13:28:50.',
			);
		});
	});
});
