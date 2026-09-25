const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "ASTUTE_BETA_OB53_1778864677");

const targets = [
  "version.ggbluepanda.com",
  "version.astutech.online",
  "ggbluepanda",
  "astutech",
  "verAddr",
  "localconfig.json",
  "resetGuestBeforeLogin"
];

function scanFolder(folder) {
  const entries = fs.readdirSync(folder, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      scanFolder(fullPath);
      continue;
    }

    try {
      const buffer = fs.readFileSync(fullPath);

      for (const target of targets) {
        if (buffer.includes(Buffer.from(target))) {
          console.log("\nFOUND:", target);
          console.log("FILE:", fullPath);
        }
      }
    } catch (err) {
      // Ignore unreadable files
    }
  }
}

console.log("Scanning APK files...");
scanFolder(root);
console.log("\nScan finished.");