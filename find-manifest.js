const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "ASTUTE_BETA_OB53_1778864677",
  "AndroidManifest.xml"
);

const target = "122.11.128.69";

const buffer = fs.readFileSync(file);

console.log("File size:", buffer.length);

let index = buffer.indexOf(Buffer.from(target));

if (index === -1) {
  console.log("ASCII string not found.");

  const utf16 = Buffer.from(target, "utf16le");
  index = buffer.indexOf(utf16);

  if (index === -1) {
    console.log("UTF-16 string not found either.");
    process.exit();
  }

  console.log("Found as UTF-16LE at offset:", index);
} else {
  console.log("Found as ASCII at offset:", index);
}

const start = Math.max(0, index - 500);
const end = Math.min(buffer.length, index + 500);

const chunk = buffer.subarray(start, end);

console.log("\nASCII-ish context:\n");

console.log(
  chunk
    .toString("latin1")
    .replace(/[^\x20-\x7E\r\n]/g, ".")
);