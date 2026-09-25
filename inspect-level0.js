const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "ASTUTE_BETA_OB53_1778864677",
  "assets",
  "bin",
  "Data",
  "level0"
);

const targets = [
  "ABHotUpdates",
  "freefiremobile-a.akamaihd.net",
  "10.21.248.178",
  "10.21.248.113",
  "39001",
  "IconCDN"
];

const buffer = fs.readFileSync(file);

console.log("level0 size:", buffer.length, "bytes");

let output = "";

function printableStrings(buf) {
  const ascii = buf
    .toString("latin1")
    .match(/[ -~]{4,}/g) || [];

  return ascii;
}

for (const target of targets) {
  output += "\n====================================\n";
  output += `TARGET: ${target}\n`;
  output += "====================================\n";

  let found = false;

  // ASCII
  let index = buffer.indexOf(Buffer.from(target, "utf8"));

  if (index !== -1) {
    found = true;

    output += `ASCII offset: ${index}\n\n`;

    const start = Math.max(0, index - 2000);
    const end = Math.min(buffer.length, index + 2000);

    const chunk = buffer.subarray(start, end);

    output += "Nearby printable strings:\n";

    for (const str of printableStrings(chunk)) {
      output += str + "\n";
    }
  }

  // UTF-16LE
  index = buffer.indexOf(Buffer.from(target, "utf16le"));

  if (index !== -1) {
    found = true;

    output += `\nUTF-16LE offset: ${index}\n`;

    const start = Math.max(0, index - 2000);
    const end = Math.min(buffer.length, index + 2000);

    const chunk = buffer.subarray(start, end);

    output += "\nUTF-16LE context:\n";
    output += chunk
      .toString("utf16le")
      .replace(/[^\x20-\x7E\r\n]/g, ".") +
      "\n";
  }

  if (!found) {
    output += "Not found.\n";
  }
}

const outputFile = path.join(
  __dirname,
  "level0-context.txt"
);

fs.writeFileSync(outputFile, output);

console.log("Done.");
console.log("Saved:", outputFile);