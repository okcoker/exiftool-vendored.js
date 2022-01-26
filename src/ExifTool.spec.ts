import { BatchCluster } from "batch-cluster"
import { path as _path } from "./deps.ts"
import { times } from "./Array.ts"
import { ExifDate } from "./ExifDate.ts"
import { ExifDateTime } from "./ExifDateTime.ts"
import { ExifTime } from "./ExifTime.ts"
import { DefaultMaxProcs, ExifTool, exiftool, WriteTags } from "./ExifTool.ts"
import { parseJSON } from "./JSON.ts"
import { keys } from "./Object.ts"
import { leftPad } from "./String.ts"
import { Tags } from "./Tags.ts"
import { expect, isWin32, testImg } from "./_chai.spec.ts"

const __dirname = _path.dirname(_path.fromFileUrl(import.meta.url));

function normalize(tagNames: string[]): string[] {
  return tagNames
    .filter((i) => i !== "FileInodeChangeDate" && i !== "FileCreateDate")
    .sort()
}

function posixPath(path: string) {
  return path.split(_path.sep).join("/")
}

after(() => exiftool.end())

describe("ExifTool", function () {
  this.timeout(15000)
  this.slow(100)

  const truncated = _path.join(__dirname, "..", "test", "truncated.jpg")
  const noexif = _path.join(__dirname, "..", "test", "noexif.jpg")
  const img = _path.join(__dirname, "..", "test", "img.jpg")
  const img2 = _path.join(__dirname, "..", "test", "ExifTool.jpg")
  const img3 = _path.join(__dirname, "..", "test", "with_thumb.jpg")
  const nonEnglishImg = _path.join(__dirname, "..", "test", "中文.jpg")

  const packageJson = require("../package.json")

  function expectedExiftoolVersion(flavor: "exe" | "pl" = "pl"): string {
    const vendorVersion: string =
      packageJson.optionalDependencies["exiftool-vendored." + flavor]
    // Everyone's a monster here:
    // * semver is pissy about 0-padded version numbers (srsly, it's ok)
    // * exiftool bumps the major version because minor hit 99</rant>

    // vendorVersion might have a ^ or ~ or something else as a prefix, so get
    // rid of that:
    return vendorVersion
      .replace(/^[^.0-9]+/, "")
      .split(".")
      .slice(0, 2)
      .map((ea) => leftPad(ea, 2, "0"))
      .join(".")
  }

  it("perl and win32 versions match", () => {
    const pl = expectedExiftoolVersion("pl")
    const exe = expectedExiftoolVersion("exe")
    expect(pl).to.eql(exe)
  })

  it("exports a singleton instance", () => {
    // don't call any methods that actually results in spinning up a child
    // proc:
    expect(exiftool.options.maxProcs).to.eql(DefaultMaxProcs)
  })

  const ignoreShebangs = []
  if (exiftool.options.ignoreShebang) {
    // If the default is true, we can only test true.
    ignoreShebangs.push(true)
  } else {
    ignoreShebangs.push(false)
    if (!isWin32()) ignoreShebangs.push(true)
  }

  for (const ignoreShebang of ignoreShebangs) {
    describe("exiftool({ ignoreShebang: " + ignoreShebang + " })", () => {
      let et: ExifTool

      before(
        () =>
          (et = new ExifTool({
            maxProcs: 2,
            ignoreShebang,
          }))
      )
      after(() => et.end())

      it("returns the correct version", async function () {
        this.slow(500)
        return expect(await et.version()).to.eql(expectedExiftoolVersion())
      })

      it("returns a reasonable value for MaxProcs", () => {
        // 64 cpus on my dream laptop
        expect(DefaultMaxProcs).to.be.within(1, 64)
      })

      it("returns expected results for a given file", async function () {
        this.slow(500)
        return expect(
          et.read(img).then((tags) => tags.Model)
        ).to.eventually.eql("iPhone 7 Plus")
      })

      it("returns raw tag values", async () => {
        return expect(et.readRaw(img, ["-Make", "-Model"])).to.eventually.eql({
          Make: "Apple",
          Model: "iPhone 7 Plus",
          SourceFile: posixPath(img),
        }) // and nothing else
      })

      it("returns expected results for a given file with non-english filename", async function () {
        this.slow(500)
        return expect(
          et.read(nonEnglishImg).then((tags) => tags.Model)
        ).to.eventually.eql("iPhone 7 Plus")
      })

      it("renders Orientation as numbers", async () => {
        const tags = await et.read(img)
        expect(tags.Orientation).to.eql(1)
        return
      })

      it("omits OriginalImage{Width,Height} by default", async () => {
        return expect(await et.read(img2)).to.containSubset({
          Keywords: "jambalaya",
          ImageHeight: 8,
          ImageWidth: 8,
          OriginalImageHeight: undefined,
          OriginalImageWidth: undefined,
        })
      })

      it("extracts OriginalImage{Width,Height} if [] is provided to override the -fast option", async () => {
        return expect(await et.read(img2, [])).to.containSubset({
          Keywords: "jambalaya",
          ImageHeight: 8,
          ImageWidth: 8,
          OriginalImageHeight: 16,
          OriginalImageWidth: 16,
        })
      })

      it("returns warning for a truncated file", async () => {
        return expect(await et.read(truncated)).to.containSubset({
          FileName: "truncated.jpg",
          FileSize: "1000 bytes",
          FileType: "JPEG",
          FileTypeExtension: "jpg",
          MIMEType: "image/jpeg",
          Warning: "JPEG format error",
        })
      })

      it("returns no exif metadata for an image with no headers", () => {
        return expect(
          et.read(noexif).then((tags) => normalize(Object.keys(tags)))
        ).to.become(
          normalize([
            "BitsPerSample",
            "ColorComponents",
            "Directory",
            "EncodingProcess",
            "ExifToolVersion",
            "FileAccessDate",
            "FileModifyDate",
            "FileName",
            "FilePermissions",
            "FileSize",
            "FileType",
            "FileTypeExtension",
            "ImageHeight",
            "ImageSize",
            "ImageWidth",
            "Megapixels",
            "MIMEType",
            "SourceFile",
            "YCbCrSubSampling",
            "errors",
          ])
        )
      })

      it("returns error for missing file", () => {
        return expect(et.read("bogus")).to.eventually.be.rejectedWith(
          /ENOENT|file not found/i
        )
      })

      it("works with text files", async () => {
        return expect(await et.read(__filename)).to.containSubset({
          FileType: "TXT",
          FileTypeExtension: "txt",
          MIMEType: "text/plain",
          // may be utf-8 or us-ascii, but we don't really care.
          // MIMEEncoding: "us-ascii",
          errors: [],
        })
      })

      function assertReasonableTags(tags: Tags[]): void {
        tags.forEach((tag) => {
          expect(tag.errors).to.eql([])
          expect(tag.MIMEType).to.eql("image/jpeg")
          expect(tag.GPSLatitude).to.be.within(-90, 90)
          expect(tag.GPSLongitude).to.be.within(-180, 180)
        })
      }

      it("ends procs when they've run > maxTasksPerProcess", async function () {
        const maxProcs = 5
        const maxTasksPerProcess = 8
        const et2 = new ExifTool({ maxProcs, maxTasksPerProcess })

        const iters = maxProcs * maxTasksPerProcess
        // Warm up the children:
        const promises = times(iters, () => et2.read(img))
        const tags = await Promise.all(promises)

        // I don't want to expose the .batchCluster field as part of the public API:
        const bc = et2["batchCluster"] as BatchCluster
        expect(bc.spawnedProcCount).to.be.gte(maxProcs)
        expect(bc.meanTasksPerProc).to.be.within(
          maxTasksPerProcess / 2,
          maxTasksPerProcess
        )
        assertReasonableTags(tags)
        await et2.end()
        expect(await et2.pids).to.eql([])
        return
      })

      it("ends with multiple procs", async function () {
        const maxProcs = 4
        const et2 = new ExifTool({ maxProcs })
        try {
          const tasks = await Promise.all(
            times(maxProcs * 4, () => et2.read(img3))
          )
          tasks.forEach((t) =>
            expect(t).to.include({
              // SourceFile: img3, Don't include SourceFile, because it's wonky on windows. :\
              MIMEType: "image/jpeg",
              Model: "Pixel",
              ImageWidth: 4048,
              ImageHeight: 3036,
            })
          )
          await et2.end()
          expect(await et2.pids).to.eql([])
        } finally {
          await et2.end()
        }
        return
      })

      it("invalid images throw errors on write", async function () {
        const badImg = await testImg("bad-exif-ifd.jpg")
        return expect(
          et.write(badImg, { AllDates: new Date().toISOString() })
        ).to.be.rejectedWith(/Duplicate MakerNoteUnknown/)
      })

      it("reads from a dSLR", async () => {
        const t = await et.read("./test/oly.jpg")
        expect(t).to.contain({
          MIMEType: "image/jpeg",
          Make: "OLYMPUS IMAGING CORP.",
          Model: "E-M1",
          ExposureTime: "1/320",
          FNumber: 5,
          ExposureProgram: "Program AE",
          ISO: 200,
          Aperture: 5,
          MaxApertureValue: 2.8,
          ExifImageWidth: 3200,
          ExifImageHeight: 2400,
          LensInfo: "12-40mm f/2.8",
          LensModel: "OLYMPUS M.12-40mm F2.8",
          tz: "UTC-07",
        })
        expect(t.DateTimeOriginal?.toString()).to.eql(
          "2014-07-19T12:05:19.000-07:00"
        )
      })

      it("reads from a smartphone with GPS", async () => {
        const t = await et.read("./test/pixel.jpg")
        expect(t).to.containSubset({
          MIMEType: "image/jpeg",
          Make: "Google",
          Model: "Pixel",
          ExposureTime: "1/831",
          FNumber: 2,
          ExposureProgram: "Program AE",
          ISO: 50,
          Aperture: 2,
          MaxApertureValue: 2,
          ExifImageWidth: 4048,
          ExifImageHeight: 3036,
          GPSLatitude: 37.4836666666667,
          GPSLongitude: -122.452094444444,
          GPSLatitudeRef: "North",
          GPSLongitudeRef: "West",
          GPSAltitude: 47,
          tz: "America/Los_Angeles",
        })
        expect(t.SubSecDateTimeOriginal?.toString()).to.eql(
          "2016-12-13T09:05:27.120-08:00"
        )
      })

      it("reads from a directory with dots", async () => {
        const dots = await testImg("img.jpg", "2019.05.28")
        const tags = await et.read(dots)
        expect(tags).to.containSubset({
          MIMEType: "image/jpeg",
          GPSLatitudeRef: "North",
          GPSLongitudeRef: "East",
          Make: "Apple",
          Model: "iPhone 7 Plus",
          FNumber: 1.8,
          tz: "Asia/Hong_Kong",
        })
        expect(tags.DateTimeCreated).to.eql(
          ExifDateTime.fromISO(
            "2016-08-12T13:28:50",
            "Asia/Hong_Kong",
            "2016:08:12 13:28:50"
          )
        )
      })

      it("deleteAllTags() removes all metadata tags", async () => {
        const f = await testImg()
        const before = await et.read(f)
        // This is just a sample of additional tags that are expected to be removed:
        const expectedBeforeTags = [
          "ApertureValue",
          "DateCreated",
          "DateTimeOriginal",
          "Flash",
          "GPSAltitude",
          "GPSLatitude",
          "GPSLongitude",
          "GPSTimeStamp",
          "LensInfo",
          "Make",
          "Model",
          "ShutterSpeedValue",
          "TimeCreated",
          "XPKeywords",
        ]

        // These are intrinsic fields that are expected to remain:
        const expectedAfterTags = [
          "BitsPerSample",
          "ColorComponents",
          "Directory",
          "EncodingProcess",
          "errors",
          "ExifToolVersion",
          "FileAccessDate",
          "FileModifyDate",
          "FileName",
          "FilePermissions",
          "FileSize",
          "FileType",
          "FileTypeExtension",
          "ImageHeight",
          "ImageSize",
          "ImageWidth",
          "Megapixels",
          "MIMEType",
          "SourceFile",
          "YCbCrSubSampling",
        ]
        {
          const beforeKeys = keys(before)
          ;[...expectedBeforeTags, ...expectedAfterTags].forEach((ea) =>
            expect(beforeKeys).to.include(ea)
          )
        }
        await et.deleteAllTags(f)
        const after = await et.read(f)
        const afterKeys = keys(after).sort()
        expectedBeforeTags.forEach((ea) => expect(afterKeys).to.not.include(ea))
        expectedAfterTags.forEach((ea) => expect(afterKeys).to.include(ea))
      })

      it("supports unknown tags via generics", async () => {
        const dest = await testImg()

        interface A {
          // I couldn't find any writable tags that we're in Tags, so this is
          // just incorrectly cased:
          rating: number
        }

        type CustomWriteTags = WriteTags & A

        await et.write<CustomWriteTags>(dest, { rating: 3 }, [
          "-overwrite_original",
        ])

        type CustomTags = Tags & A

        const t = await et.read<CustomTags>(dest)
        // this should compile...
        expect(t.rating).to.eql(undefined)
        // but ExifTool will have done the conversion to "Rating":
        expect(t.Rating).to.eql(3)
      })
    })
  }

  describe("parseJSON", () => {
    it("round-trips", async () => {
      const t = await exiftool.read(img3)

      function assert(ea: Tags) {
        expect((ea.SubSecCreateDate as any).constructor).to.eql(ExifDateTime)
        expect((ea.GPSTimeStamp as any).constructor).to.eql(ExifTime)
        expect((ea.GPSDateStamp as any).constructor).to.eql(ExifDate)

        expect({
          datetime: ea.SubSecCreateDate?.toString(),
          time: ea.GPSTimeStamp?.toString(),
          date: ea.GPSDateStamp?.toString(),
        }).to.eql({
          datetime: "2017-12-22T17:08:35.363-08:00",
          time: "01:08:22",
          date: "2017-12-23",
        })

        // Verify that all primitive types are as expected:
        expect(ea.ISO).to.eql(60)
        expect(ea.FNumber).to.be.closeTo(2.0, 0.01)
        expect(ea.Contrast).to.eql("Normal")
        expect(ea.Keywords).to.eql(["red fish", "blue fish"])
      }

      assert(t)

      const t2 = parseJSON(JSON.stringify(t))
      assert(t2)

      expect(t2.SubSecCreateDate).to.eql(t.SubSecCreateDate)
      expect(t2.GPSDateTime).to.eql(t.GPSDateTime)
      expect(t2.GPSDateStamp).to.eql(t.GPSDateStamp)
    })
  })
})
