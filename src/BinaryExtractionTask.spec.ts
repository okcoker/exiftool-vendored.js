import {
    afterAll as after,
    describe,
    expect,
    it,
    sha1,
    tmpname,
} from './_chai.spec.ts';
import { BinaryExtractionTask } from './BinaryExtractionTask.ts';
import { ExifTool } from './ExifTool.ts';
import { assert, path } from './deps.ts';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testDir = path.join(__dirname, '..', 'test');
describe('BinaryExtractionTask', () => {
    const exiftool = new ExifTool({ maxProcs: 1 });
    after(() => exiftool.end());

    describe('parser', () => {
        const sut = BinaryExtractionTask.for('ThumbnailImage', '', '');
        it('returns success (undefined, no error) from expected input', () => {
            expect(sut.parse('    1 output files created')).to.eql(undefined);
        });
        it('returns error from expected input', () => {
            expect(sut.parse('     0 output files created')).to.eql(
                '0 output files created',
            );
        });
        it('throws on empty input', () => {
            expect(() => sut.parse('')).to.throw(
                /Missing expected status message/,
            );
        });
        it('extracts the expected error message', () => {
            expect(() =>
                sut.parse(
                    [
                        'Error creating /etc/test.jpg',
                        '1 files could not be read',
                    ].join(
                        '\n',
                    ),
                )
            ).to.throw(/Error creating \/etc\/test.jpg/);
        });
    });

    it('extracts expected thumb', async function () {
        // @todo check on this later
        // this.slow(500)
        const src = path.join(testDir, 'with_thumb.jpg');
        const dest = await tmpname();
        await exiftool.extractThumbnail(src, dest);
        // exiftool test/with_thumb.jpg -b -ThumbnailImage | sha1sum
        expect(await sha1(dest)).to.eql(
            '57885e5e16b16599ccf208981a87fe198612d9fb',
        );
    });

    it('throws for missing src', async function () {
        // @todo check on this later
        // this.slow(500)
        const src = path.join(testDir, 'nonexistant-file.jpg');
        const dest = await tmpname();
        try {
            await exiftool.extractJpgFromRaw(src, dest);
            assert.fail('expected error to be thrown');
        } catch (err) {
            expect(String(err)).to.match(/File not found/i);
        }
    });

    it('throws for missing thumb', async function () {
        // @todo check on this later
        // this.slow(500)
        const src = path.join(testDir, 'with_thumb.jpg');
        const dest = await tmpname();
        try {
            await exiftool.extractJpgFromRaw(src, dest);
            assert.fail('expected error to be thrown');
        } catch (err) {
            expect(String(err)).to.match(/Error: 0 output files created/i);
        }
    });
});
