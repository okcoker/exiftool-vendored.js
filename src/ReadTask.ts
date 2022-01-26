import { logger } from "batch-cluster"
import { path as _path } from "./deps.ts"
import { ExifDate } from "./ExifDate.ts"
import { ExifDateTime } from "./ExifDateTime.ts"
import { ExifTime } from "./ExifTime.ts"
import { ExifToolTask } from "./ExifToolTask.ts"
import { firstDefinedThunk, map } from "./Maybe.ts"
import { toF } from "./Number.ts"
import { blank, isString, toS } from "./String.ts"
import { Tags } from "./Tags.ts"
import {
  extractTzOffsetFromTags,
  extractTzOffsetFromUTCOffset,
} from "./Timezones.ts"
const tzlookup = require("tz-lookup")

/**
 * tag names we don't need to muck with:
 */
const PassthroughTags = [
  "ExifToolVersion",
  "DateStampMode",
  "Sharpness",
  "Firmware",
  "DateDisplayFormat",
]

const nullishes = ["undef", "null", "undefined"]

export function nullish(s: string | undefined): s is undefined {
  return s == null || (isString(s) && nullishes.includes(s.trim()))
}

export class ReadTask extends ExifToolTask<Tags> {
  private readonly degroup: boolean
  /** May have keys that are group-prefixed */
  private _raw: any = {}
  /** Always has non-group-prefixed keys */
  private _tags: any = {}
  private readonly tags: Tags
  private lat: number | undefined
  private lon: number | undefined
  private invalidLatLon = false
  private tz: string | undefined
  private tzSource?: string

  private constructor(
    readonly sourceFile: string,
    override readonly args: string[]
  ) {
    super(args)
    this.degroup = this.args.indexOf("-G") !== -1
    this.tags = { SourceFile: sourceFile } as Tags
    this.tags.errors = this.errors
  }

  static for(
    filename: string,
    numericTags: string[],
    optionalArgs: string[] = []
  ): ReadTask {
    const sourceFile = _path.resolve(filename)
    const args = [
      "-json",
      "-struct", // Return struct tags https://exiftool.org/struct.html
      ...optionalArgs,
    ]
    // IMPORTANT: "-all" must be after numeric tag references (first reference
    // in wins)
    args.push(...numericTags.map((ea) => "-" + ea + "#"))
    // TODO: Do you need -xmp:all, -all, or -all:all?
    args.push("-all", "-charset", "filename=utf8", sourceFile)
    return new ReadTask(sourceFile, args)
  }

  override toString(): string {
    return "ReadTask" + this.sourceFile + ")"
  }

  parse(data: string, err?: Error): Tags {
    try {
      this._raw = JSON.parse(data)[0]
    } catch (jsonError) {
      // TODO: should restart exiftool?
      logger().warn("ExifTool.ReadTask(): Invalid JSON", {
        data,
        err,
        jsonError,
      })
      throw err ?? jsonError
    }
    // ExifTool does "humorous" things to paths, like flip path separators. resolve() undoes that.
    const SourceFile = _path.resolve(this._raw.SourceFile)
    // Sanity check that the result is for the file we want:
    if (SourceFile !== this.sourceFile) {
      // Throw an error rather than add an errors string because this is *really* bad:
      throw new Error(
        `Internal error: unexpected SourceFile of ${this._raw.SourceFile} for file ${this.sourceFile}`
      )
    }
    if (this.degroup) {
      Object.keys(this._raw).forEach((keyWithGroup) => {
        this._tags[this.tagName(keyWithGroup)] = this._raw[keyWithGroup]
      })
    } else {
      this._tags = this._raw
    }

    return this.parseTags()
  }

  private tagName(k: string): string {
    return this.degroup ? k.split(":")[1] ?? k : k
  }

  private parseTags(): Tags {
    this.extractLatLon()
    this.extractTzOffset()
    Object.keys(this._raw).forEach(
      (key) => ((this.tags as any)[key] = this.parseTag(key, this._raw[key]))
    )
    map(this.tz, (ea) => (this.tags.tz = ea))
    map(this.tzSource, (ea) => (this.tags.tzSource = ea))
    if (this.errors.length > 0) this.tags.errors = this.errors
    return this.tags as Tags
  }

  private extractLatLon() {
    this.lat ??= this.latlon("GPSLatitude", "S", 90)
    this.lon ??= this.latlon("GPSLongitude", "W", 180)
    if (this.invalidLatLon) {
      this.lat = this.lon = undefined
    }
  }

  private latlon(
    tagName: "GPSLatitude" | "GPSLongitude",
    negateRef: "S" | "W",
    maxValid: 90 | 180
  ): number | undefined {
    const tagValue = this._tags[tagName]
    const ref = this._tags[tagName + "Ref"]
    const result = toF(tagValue)
    if (result == null) {
      return
    } else if (Math.abs(result) > maxValid) {
      this.errors.push(`Invalid ${tagName}: ${JSON.stringify(tagValue)}`)
      this.invalidLatLon = true
      return
    } else if (blank(ref)) {
      // Videos may not have a GPSLatitudeRef or GPSLongitudeRef: if this is the case, assume the given sign is correct.
      return result
    } else {
      // Versions of ExifTool pre-12 returned properly-negated lat/lon. ExifTool
      // 12+ always returns positive values (!!). Also: if '-GPS*#' is set,
      // we'll see "S" instead of "South", hence the .startsWith() instead of
      // ===:
      const negative = toS(ref).toUpperCase().startsWith(negateRef)
      return (negative ? -1 : 1) * Math.abs(result)
    }
  }

  private extractTzOffset() {
    map(
      firstDefinedThunk([
        () => extractTzOffsetFromTags(this._tags),
        () => {
          if (!this.invalidLatLon && this.lat != null && this.lon != null) {
            try {
              return map(tzlookup(this.lat, this.lon), (tz) => ({
                tz,
                src: "from Lat/Lon",
              }))
            } catch (err) {
              /* */
            }
          }
          return
        },
        () => extractTzOffsetFromUTCOffset(this._tags),
      ]),
      (ea) => ({ tz: this.tz, src: this.tzSource } = ea)
    )
  }

  private parseTag(tagNameWithGroup: string, value: any): any {
    if (nullish(value)) return undefined

    const tagName = this.tagName(tagNameWithGroup)
    try {
      if (PassthroughTags.indexOf(tagName) >= 0) {
        return value
      }
      if (tagName === "GPSLatitude") {
        return this.lat
      }
      if (tagName === "GPSLongitude") {
        return this.lon
      }

      const tz =
        tagName.includes("UTC") || tagName.startsWith("GPS") ? "UTC" : this.tz

      if (typeof value === "string" && tagName.includes("DateTime")) {
        const d =
          ExifDateTime.fromExifStrict(value, tz) ??
          ExifDateTime.fromISO(value, tz)
        if (d != null) {
          return d
        }
      }
      if (typeof value === "string" && tagName.includes("Date")) {
        const d =
          ExifDateTime.fromExifStrict(value, tz) ??
          ExifDateTime.fromISO(value, tz) ??
          ExifDateTime.fromExifLoose(value, tz) ??
          ExifDate.fromExifStrict(value) ??
          ExifDate.fromISO(value) ??
          ExifDate.fromExifLoose(value)

        if (d != null) {
          return d
        }
      }
      if (typeof value === "string" && tagName.includes("Time")) {
        const t = ExifTime.fromEXIF(value)
        if (t != null) return t
      }
      // Trust that ExifTool rendered the value with the correct type in JSON:
      return value
    } catch (e) {
      this.addError(
        `Failed to parse ${tagName} with value ${JSON.stringify(value)}: ${e}`
      )
      return value
    }
  }
}
