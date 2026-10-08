import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const file = path.join(process.cwd(), "public/avatar/speaker.jpg");
const maxBytes = 2 * 1024 * 1024;

async function main() {
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("is not a file");
    if (info.size > maxBytes) throw new Error(`is ${info.size} bytes; maximum is ${maxBytes}`);
    const header = await readFile(file, { encoding: null });
    if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
      throw new Error("does not have a JPEG signature");
    }
    console.log(`Avatar asset is present (${info.size} bytes).`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Invalid avatar asset at public/avatar/speaker.jpg: ${reason}`);
    process.exitCode = 1;
  }
}

void main();
