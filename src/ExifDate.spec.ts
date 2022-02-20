import { describe, expect, it } from './_chai.spec.ts';
import { ExifDate } from './ExifDate.ts';

describe('ExifDate', () => {
    for (
        const { text, iso } of [
            { text: '2018:9:3', iso: '2018-09-03' },
            { text: '2018:02:09', iso: '2018-02-09' },
            { text: '2018-02-09', iso: '2018-02-09' },
            { text: '2018:10:30', iso: '2018-10-30' },
            { text: 'Mar 4 2018', iso: '2018-03-04' },
            { text: 'April 09 2018', iso: '2018-04-09' },
        ]
    ) {
        it(`parses ${iso} (${text})`, () => {
            const ed = ExifDate.fromEXIF(text);
            expect(ed?.toISOString()).to.eql(iso);
            expect(ed?.rawValue).to.eql(text);
        });
    }
    for (const ea of ['', '   ', '0000', '1958', '2010_08']) {
        it(`rejects "${ea}"`, () => {
            expect(ExifDate.fromEXIF(ea)).to.eql(undefined);
        });
    }
});
