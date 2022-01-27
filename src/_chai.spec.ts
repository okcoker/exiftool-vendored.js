
import { expect, use } from 'https://cdn.skypack.dev/chai@4.3.4?dts';
import { default as chaiSubset } from 'https://cdn.skypack.dev/chai-subset@1.6.0?dts';
import { default as chaiAsPromised } from 'https://cdn.skypack.dev/chai-as-promised@7.1.1?dts';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	it,
	test
} from 'https://deno.land/x/test_suite@0.9.5/mod.ts';
import { path, getOSTempDir, BatchCluster, Buffer, copyFile, mkdirp, encode, crypto } from "./deps.ts"

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const { Deferred, Log, setLogger } = BatchCluster;

use(chaiAsPromised)
use(chaiSubset)

// Tests should be quiet unless LOG is set
setLogger(
  Log.withLevels(
    Log.withTimestamps(
      Log.filterLevels(
        {
          trace: console.log,
          debug: console.log,
          info: console.log,
          warn: console.warn,
          error: console.error,
        },
        Deno.env.get('LOG') as any ?? "error"
      )
    )
  )
)

export const testDir = path.join(__dirname, "..", "test")

export function tmpname(prefix = ""): string {
  return path.join(
    getOSTempDir(),
    prefix + Math.floor(Math.random() * 1e9).toString(16)
  )
}

/**
 * Copy a test image to a tmp directory and return the path
 */
export async function testImg(
  name = "img.jpg",
  parentDir = "test"
): Promise<string> {
  const dir = path.join(tmpname(), parentDir)
  await mkdirp(dir)
  const dest = path.join(dir, name)
  return copyFile(path.join(testDir, name), dest).then(() => dest)
}

export async function testFile(name: string): Promise<string> {
  const dir = tmpname()
  await mkdirp(dir)
  return path.join(dir, name)
}

export async function sha1(path: string): Promise<string> {
  const file = await Deno.readTextFile(path)
  const digest = await crypto.subtle.digest(
    "BLAKE3",
    new TextEncoder().encode(file),
  )
  const arr = new Uint8Array(digest);

  return new TextDecoder().decode(encode(arr));
}

export async function sha1buffer(input: string | Buffer): Promise<string> {
  const digest = await crypto.subtle.digest(
    "BLAKE3",
    typeof input === 'string' ? new TextEncoder().encode(input) : input,
  )
  const arr = new Uint8Array(digest);

  return new TextDecoder().decode(encode(arr));
  // return crypto.createHash("sha1").update(input).digest().toString("hex")
}

export function isWin32() {
  return Deno.build.os === "windows"
}

export {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	test
};
