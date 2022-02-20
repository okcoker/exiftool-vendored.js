import { luxon } from './deps.ts';
import { ExifDate } from './ExifDate.ts';
import { ExifDateTime } from './ExifDateTime.ts';
import { ExifTime } from './ExifTime.ts';
import { Maybe } from './Maybe.ts';

export function validDateTime(dt: luxon.DateTime): boolean {
    return dt != null && dt.isValid;
}

export const MinuteMs = 60 * 1000;
export const HourMs = 60 * MinuteMs;
export const DayMs = 24 * HourMs;

export type DateOrTime = ExifDateTime | ExifDate | ExifTime | luxon.DateTime;

export function isDateOrTime(o: any): o is DateOrTime {
    return (
        o instanceof ExifDateTime ||
        o instanceof ExifDate ||
        o instanceof ExifTime ||
        o instanceof luxon.DateTime
    );
}

export function dateTimeToExif(d: luxon.DateTime): string {
    return d.toFormat('y:LL:dd HH:mm:ss.u');
}

export function toExifString(d: DateOrTime): Maybe<string> {
    if (d instanceof luxon.DateTime) {
        return dateTimeToExif(d);
    } else {
        return d.toExifString();
    }
}
