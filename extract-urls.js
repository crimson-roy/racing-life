const fs = require("fs");
const path = require("path");

const root = path.join(
  __dirname,
  "ASTUTE_BETA_OB53_1778864677"
);

const results = new Map();

function addUrl(url, file) {
  // Clean common binary garbage from the end
  url = url.replace(/[\x00-\x20"'<>\\]+$/g, "");

  if (!results.has(url)) {
    results.set(url, new Set());
  }

  results.get(url).add(file);
}

function extractFromBuffer(buffer, file) {
  // Normal ASCII / UTF-8-ish strings
  const text = buffer.toString("latin1");

  const asciiRegex =
    /https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g;

  const matches = text.match(asciiRegex) || [];

  for (const url of matches) {
    addUrl(url, file);
  }

  // Also check UTF-16LE strings
  const utf16 = buffer.toString("utf16le");

  const utf16Matches = utf16.match(asciiRegex) || [];

  for (const url of utf16Matches) {
    addUrl(url, file);
  }
}

function scanFolder(folder) {
  const entries = fs.readdirSync(folder, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      scanFolder(fullPath);
      continue;
    }

    try {
      const buffer = fs.readFileSync(fullPath);
      extractFromBuffer(buffer, fullPath);
    } catch {
      // Ignore files Node cannot read
    }
  }
}

console.log("Scanning APK for URLs...\n");

scanFolder(root);

const output = [];

for (const [url, files] of results) {
  output.push(`URL: ${url}`);

  for (const file of files) {
    output.push(`  FILE: ${file}`);
  }

  output.push("");
}

fs.writeFileSync(
  path.join(__dirname, "urls-found.txt"),
  output.join("\n")
);

console.log(`Found ${results.size} unique URLs.`);
console.log("Saved results to urls-found.txt");