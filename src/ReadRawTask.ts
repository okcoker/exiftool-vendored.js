import { path as _path, BatchCluster } from "./deps.ts"
import { ExifToolTask } from "./ExifToolTask.ts"
import { Tags } from "./Tags.ts"

const { logger } = BatchCluster;
export class ReadRawTask extends ExifToolTask<Tags> {
  static for(filename: string, exiftoolArgs: string[] = []): ReadRawTask {
    const args = [...exiftoolArgs]
    if (!args.includes("-json")) args.unshift("-json")
    const sourceFile = _path.resolve(filename)
    args.push(sourceFile)
    return new ReadRawTask(sourceFile, args)
  }

  private constructor(
    readonly sourceFile: string,
    override readonly args: string[]
  ) {
    super(args)
  }

  override toString(): string {
    return "ReadRawTask" + this.sourceFile + ")"
  }

  protected parse(data: string, err?: Error): Tags {
    try {
      return JSON.parse(data)[0]
    } catch (jsonError) {
      logger().error("ExifTool.ReadRawTask(): Invalid JSON", { data })
      throw err ?? jsonError
    }
  }
}
