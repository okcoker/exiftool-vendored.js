import { ExifDate } from './ExifDate.ts';
import { ExifDateTime } from './ExifDateTime.ts';
import { ExifTool, WriteTags } from './ExifTool.ts';
import { isFileEmpty } from './File.ts';
import { map } from './Maybe.ts';
import { isSidecarExt } from './Sidecars.ts';
import { stripSuffix } from './String.ts';
import { Struct } from './Struct.ts';
import { Tags } from './Tags.ts';
import {
    afterAll,
    describe,
    expect,
    it,
    testFile,
    testImg,
} from './_chai.spec.ts';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

describe('WriteTask', function () {
    // @todo check on this later
    // this.slow(1) // always show timings
    for (
        const opts of [
            { maxProcs: 1, maxRetries: 0 },
            { maxProcs: 3, maxRetries: 3 },
        ]
    ) {
        describe(`new ExifTool(${JSON.stringify(opts)})`, () => {
            const exiftool = new ExifTool(opts);
            afterAll(() => exiftool.end());

            type InputValue = string | number | Struct;

            async function assertRoundTrip({
                dest,
                tagName,
                inputValue,
                expectedValue,
                args,
                cmp,
            }: {
                dest: string;
                tagName: keyof WriteTags;
                inputValue: InputValue | InputValue[];
                expectedValue?: any;
                args?: string[];
                cmp?: (actual: any, tags: Tags) => any;
            }) {
                const wt: WriteTags = {};
                wt[tagName] = inputValue as any;
                await exiftool.write(dest, wt, args);
                const result = (await exiftool.read(dest)) as any;
                const expected = expectedValue ?? inputValue;
                const cleanTagName = stripSuffix(tagName, '#');
                const actual = result[cleanTagName];
                if (cmp != null) {
                    cmp(actual, result);
                } else {
                    expect(actual).to.eql(
                        expected,
                        JSON.stringify({
                            src: dest,
                            tagName,
                            expected,
                            actual,
                        }),
                    );
                }
                return;
            }

            // Well-supported text tag name:
            const textTagName = 'Description';

            // Well-supported multi-value string tag:
            const multiTagName = 'TagsList' as any;

            function runRoundTripTests({
                withTZ,
                dest,
            }: {
                withTZ: boolean;
                dest: (basename?: string) => Promise<string>;
            }) {
                const tzo = withTZ ? '+08:00' : '';
                it('round-trips a comment', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: textTagName,
                        inputValue: 'new comment from ' + new Date(),
                    });
                });

                it('round-trips a comment with many whitespace flavors', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: textTagName,
                        inputValue: 'a\rnew\ncomment\n\r\tfrom\r\n' +
                            new Date(),
                    });
                });

                it('round-trips a non-latin comment', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: textTagName,
                        inputValue: '早安晨之美' + new Date(),
                    });
                });

                it('round-trips a comment with simple and compound codepoint emoji', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: textTagName,
                        inputValue: '⌚✨💑🏽👰🏽🦏🌈🦍🦄🧑‍🤝‍🧑🚵‍♀️ ' + new Date(),
                    });
                });

                it('round-trips a comment with non-latin filename', async () => {
                    return assertRoundTrip({
                        dest: await dest('中文'),
                        tagName: textTagName,
                        inputValue: 'new comment from ' + new Date(),
                    });
                });

                it('round-trips a non-latin comment with non-latin filename', async () => {
                    return assertRoundTrip({
                        dest: await dest('中文'),
                        tagName: textTagName,
                        inputValue: '早安晨之美' + new Date(),
                    });
                });

                it('round-trips a rtl comment', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: textTagName,
                        inputValue: 'مرحبا بالعالم ' + new Date(),
                    });
                });

                it('round-trips a numeric Orientation', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: 'Orientation#',
                        inputValue: 1,
                    });
                });

                it('round-trips a string Orientation 90 CW', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: 'Orientation#',
                        inputValue: 6,
                    });
                });

                it('round-trips a string Orientation 180 CW', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: 'Orientation#',
                        inputValue: 3,
                    });
                });

                it('updates ExposureTime to a specific time', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: 'ExposureTime',
                        inputValue: '1/300',
                    });
                });

                it('updates DateTimeOriginal to a specific time', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: 'DateTimeOriginal',
                        inputValue: '2017-11-15T12:34:56' + tzo,
                        cmp: (actual: ExifDateTime) => {
                            expect(actual.toISOString()).to.eql(
                                `2017-11-15T12:34:56.000${tzo}`,
                            );
                        },
                    });
                });

                it('round-trips list tag array input', async () => {
                    return assertRoundTrip({
                        dest: await dest(),
                        tagName: multiTagName,
                        inputValue: ['one', 'two', 'three', 'commas, even!'],
                    });
                });

                it('updates DateTimeDigitized with TimeZoneOffset', async () => {
                    const src = await dest();
                    const wt: WriteTags = {
                        DateTimeDigitized: new ExifDateTime(
                            2010,
                            7,
                            13,
                            14,
                            15,
                            16,
                            123,
                        ),
                        TimeZoneOffset: +8,
                    };
                    await exiftool.write(src, wt);
                    const newTags = await exiftool.read(src);
                    const d = newTags.DateTimeDigitized as ExifDateTime;
                    expect(d.toISOString()).to.eql(
                        '2010-07-13T14:15:16.123' + tzo,
                        JSON.stringify(d),
                    );
                    return;
                });

                it('updates CreateDate to a time with zeroes and OffsetTime', async () => {
                    const src = await dest();
                    const wt: WriteTags = {
                        CreateDate: new ExifDateTime(2019, 1, 2, 0, 0, 0, 0),
                        OffsetTime: '-05:00',
                    };
                    await exiftool.write(src, wt);
                    const t = await exiftool.read(src);
                    expect(t.CreateDate?.toString()).to.eql(
                        '2019-01-02T00:00:00.000' + (withTZ ? '-05:00' : ''),
                    );
                    return;
                });

                it('updates ReleaseDate to a specific date', async () => {
                    const f = await dest();
                    const wt: WriteTags = {
                        ReleaseDate: ExifDate.fromISO('2019-01-02')!,
                    };
                    await exiftool.write(f, wt);
                    const newTags = await exiftool.read(f);
                    expect(newTags.ReleaseDate!.toISOString()).to.eql(
                        '2019-01-02',
                    );
                    return;
                });

                it('round-trips a struct tag', async () => {
                    const struct: Struct[] = [
                        { RegItemId: 'item 1', RegOrgId: 'org 1' },
                        { RegEntryRole: 'role 2', RegOrgId: 'org 2' },
                    ];
                    const f = await dest();
                    await exiftool.write(f, { RegistryID: struct });
                    const tags = await exiftool.read(f);
                    expect(tags.RegistryID).to.eql(struct);
                    return;
                });

                it('rejects setting to a non-time value', async () => {
                    const src = await dest();
                    return expect(
                        exiftool.write(src, {
                            DateTimeOriginal: 'this is not a time' as any,
                        }),
                    ).to.be.rejectedWith(/Invalid date\/time/);
                });

                it('rejects an invalid numeric Orientation', async () => {
                    const src = await dest();
                    return expect(
                        exiftool.write(src, { 'Orientation#': -1 }),
                    ).to.be.rejectedWith(/Value below int16u minimum/i);
                });

                it('rejects an invalid string Orientation', async () => {
                    const src = await dest();
                    return expect(
                        exiftool.write(src, {
                            Orientation:
                                'this isn\'t a valid orientation' as any,
                        }),
                    ).to.be.rejectedWith(/Can't convert IFD0:Orientation/i);
                });

                it('handles deleting tags from empty files', async () => {
                    const src = await dest();
                    const isSidecar = isSidecarExt(src);
                    // if sidecar, should be empty:
                    expect(await isFileEmpty(src)).to.eql(isSidecar);
                    await exiftool.write(src, { Orientation: null });
                    // still should be empty:
                    expect(await isFileEmpty(src)).to.eql(isSidecar);
                    if (!isSidecar) {
                        const t = await exiftool.read(src);
                        expect(t.Orientation).to.eql(undefined);
                    }
                });

                it('removes null values', async () => {
                    const src = await dest();
                    const ExposureTime = '1/4567';
                    // NOTE: Neither XPComment nor Comment are supported by .XMP
                    const UserComment = [
                        'Buenos días',
                        'Schönen Tag',
                        'Добрый день',
                        '良い一日',
                        'יום טוב',
                    ].join(',');

                    await exiftool.write(src, {
                        'Orientation#': 3,
                        ExposureTime,
                        UserComment,
                    } as WriteTags);

                    {
                        expect(await isFileEmpty(src)).to.eql(false);
                        const t = await exiftool.read(src);
                        expect(t).to.containSubset({
                            Orientation: 3,
                            ExposureTime,
                            UserComment,
                        });
                    }

                    await exiftool.write(
                        src,
                        { Orientation: null } as WriteTags,
                    );

                    {
                        expect(await isFileEmpty(src)).to.eql(false);
                        const t = await exiftool.read(src);
                        expect(t.Orientation).to.eql(undefined);
                        expect(t).to.containSubset({
                            ExposureTime,
                            UserComment,
                        });
                    }

                    await exiftool.write(src, {
                        ExposureTime: null,
                        UserComment: null,
                    });

                    {
                        expect(await isFileEmpty(src)).to.eql(false);
                        const t = await exiftool.read(src);
                        expect(t.Orientation).to.eql(undefined);
                        expect(t.ExposureTime).to.eql(undefined);
                        expect(t.UserComment).to.eql(undefined);
                    }
                });

                it('Accepts a shortcut tag', async () => {
                    const date = '2018-04-17T12:34:56.000+08:00';
                    const src = await dest();
                    await exiftool.write(src, { AllDates: date });
                    const tags = await exiftool.read(src);
                    expect(String(tags.DateTimeOriginal)).to.eql(date);
                    expect(String(tags.CreateDate)).to.eql(date);
                    expect(String(tags.ModifyDate)).to.eql(date);
                    return;
                });

                it('rejects unknown files', () => {
                    return expect(
                        exiftool.write('/tmp/.nonexistant-' + Date.now(), {
                            Comment: 'boom',
                        }),
                    ).to.be.rejectedWith(/ENOENT|File not found/i);
                });

                it('rejects unknown tags', async () => {
                    const src = await dest();
                    return expect(
                        exiftool.write(src, { RandomTag: 123 } as any),
                    ).to.be.rejectedWith(/Tag 'RandomTag' is not defined/);
                });
            }

            describe('round-trip with an image', () =>
                runRoundTripTests({
                    withTZ: true,
                    dest: (name) => testImg(map(name, (ea) => ea + '.jpg')),
                }));

            describe('round-trip with an XMP sidecar', () =>
                runRoundTripTests({
                    withTZ: false, // BOO XMP
                    dest: (ea) => testFile((ea ?? 'img') + '.xmp'),
                }));

            describe('round-trip with an MIE sidecar', () =>
                runRoundTripTests({
                    withTZ: true,
                    dest: (ea) => testFile((ea ?? 'img') + '.mie'),
                }));
        });
    }
});
