import { fs } from "./deps.ts"
import { blank } from "./String.ts"

export async function isFileEmpty(path: string): Promise<boolean> {
  if (blank(path)) {
    throw new Error("isFileEmpty(): blank path")
  }

  // TODO: convert this to using fs/promises once node 12 is EOL (2022-04-30)
  try {
    const s = await new Promise<fs.Stats>((res, rej) => {
      try {
        // @ts-ignore deno fs is still weird
        fs.stat(path, (err, val) => (err == null ? res(val) : rej(err)))
      } catch (err) {
        rej(err)
      }
    })
    // @ts-ignore size does exist...
    return s == null || s.size === 0
  } catch (err: any) {
    if (err.code === "ENOENT") return true
    else throw err
  }
}
