import { ExifDate } from "./ExifDate.ts"
import { ExifDateTime } from "./ExifDateTime.ts"
import { ExifTime } from "./ExifTime.ts"

const Revivers: any = {
  ExifDateTime: (ea: any) => ExifDateTime.fromJSON(ea),
  ExifDate: (ea: any) => ExifDate.fromJSON(ea),
  ExifTime: (ea: any) => ExifTime.fromJSON(ea),
}

export function parseJSON(s: string) {
  return JSON.parse(
    s,
    (_key, value) => Revivers[value?._ctor]?.(value) ?? value
  )
}
