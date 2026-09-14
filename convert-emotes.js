// ============================================================
// RACING LIFE 3D — FBX → GLB EMOTE CONVERTER
// ============================================================
//
// Put downloaded Mixamo .fbx files in:
//
//   assets/characters/animations/FBX/
//
// Put FBX2glTF.exe in:
//
//   tools/FBX2glTF.exe
//
// Then run:
//
//   node convert-emotes.js
//
// The converted .glb files will be placed in:
//
//   assets/characters/animations/
//
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ============================================================
// GET THIS SCRIPT'S LOCATION
// ============================================================

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

// ============================================================
// PATHS
// ============================================================

const toolPath =
  path.join(
    __dirname,
    'tools',
    'FBX2glTF.exe'
  );

const inputDir =
  path.join(
    __dirname,
    'assets',
    'characters',
    'animations',
    'FBX'
  );

const outputDir =
  path.join(
    __dirname,
    'assets',
    'characters',
    'animations'
  );

// ============================================================
// CHECK FBX2GLTF
// ============================================================

if (!fs.existsSync(toolPath)) {

  console.error('');
  console.error(
    'ERROR: FBX2glTF.exe was not found.'
  );

  console.error('');
  console.error(
    'Expected location:'
  );

  console.error(
    toolPath
  );

  console.error('');
  console.error(
    'Put FBX2glTF.exe inside the tools folder.'
  );

  console.error('');

  process.exit(1);
}

// ============================================================
// CHECK INPUT FOLDER
// ============================================================

if (!fs.existsSync(inputDir)) {

  console.error('');
  console.error(
    'ERROR: FBX input folder was not found.'
  );

  console.error('');
  console.error(
    'Expected location:'
  );

  console.error(
    inputDir
  );

  console.error('');

  console.error(
    'Create the folder:'
  );

  console.error(
    'assets/characters/animations/FBX'
  );

  console.error('');

  process.exit(1);
}

// ============================================================
// CREATE OUTPUT FOLDER IF NECESSARY
// ============================================================

fs.mkdirSync(
  outputDir,
  {
    recursive: true
  }
);

// ============================================================
// FIND ALL FBX FILES
// ============================================================

const files =
  fs
    .readdirSync(
      inputDir,
      {
        withFileTypes: true
      }
    )
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name
          .toLowerCase()
          .endsWith('.fbx')
    )
    .map(
      (entry) =>
        entry.name
    );

// ============================================================
// NOTHING TO CONVERT
// ============================================================

if (files.length === 0) {

  console.log('');
  console.log(
    'No .fbx emotes were found.'
  );

  console.log('');

  console.log(
    'Put your Mixamo FBX files here:'
  );

  console.log(
    inputDir
  );

  console.log('');

  process.exit(0);
}

// ============================================================
// HEADER
// ============================================================

console.log('');
console.log(
  '=============================================='
);

console.log(
  ' RACING LIFE 3D'
);

console.log(
  ' FBX → GLB EMOTE CONVERTER'
);

console.log(
  '=============================================='
);

console.log('');

// ============================================================
// COUNTERS
// ============================================================

let converted =
  0;

let skipped =
  0;

let failed =
  0;

// ============================================================
// CONVERT EACH FBX
// ============================================================

for (
  const file of files
) {

  const inputPath =
    path.join(
      inputDir,
      file
    );

  const baseName =
    path.basename(
      file,
      path.extname(file)
    );

  // FBX2glTF wants the output
  // path WITHOUT the extension.
  const outputPathWithoutExtension =
    path.join(
      outputDir,
      baseName
    );

  const outputPath =
    `${outputPathWithoutExtension}.glb`;

  console.log(
    `Converting: ${file}`
  );

  // ==========================================================
  // DON'T OVERWRITE EXISTING GLB
  // ==========================================================

  if (
    fs.existsSync(
      outputPath
    )
  ) {

    console.log(
      `  SKIPPED — already exists: ${path.basename(outputPath)}`
    );

    console.log('');

    skipped++;

    continue;
  }

  // ==========================================================
  // RUN FBX2GLTF
  // ==========================================================

  const result =
    spawnSync(
      toolPath,

      [
        '--binary',

        '--anim-framerate',
        'bake30',

        '--input',
        inputPath,

        '--output',
        outputPathWithoutExtension
      ],

      {
        encoding: 'utf8',

        windowsHide: false
      }
    );

  // ==========================================================
  // PROCESS ERROR
  // ==========================================================

  if (
    result.error
  ) {

    console.error(
      `  FAILED — ${result.error.message}`
    );

    console.log('');

    failed++;

    continue;
  }

  // ==========================================================
  // SHOW CONVERTER OUTPUT
  // ==========================================================

  if (
    result.stdout &&
    result.stdout.trim()
  ) {

    console.log(
      result.stdout.trim()
    );
  }

  if (
    result.stderr &&
    result.stderr.trim()
  ) {

    console.log(
      result.stderr.trim()
    );
  }

  // ==========================================================
  // SUCCESS
  // ==========================================================

  if (
    result.status === 0 &&
    fs.existsSync(
      outputPath
    )
  ) {

    console.log(
      `  OK → ${path.basename(outputPath)}`
    );

    console.log('');

    converted++;

  } else {

    console.error(
      `  FAILED — converter exited with code ${result.status}`
    );

    console.log('');

    failed++;
  }
}

// ============================================================
// FINAL SUMMARY
// ============================================================

console.log(
  '=============================================='
);

console.log(
  ' CONVERSION COMPLETE'
);

console.log(
  '=============================================='
);

console.log(
  `Converted: ${converted}`
);

console.log(
  `Skipped:   ${skipped}`
);

console.log(
  `Failed:    ${failed}`
);

console.log(
  `Output:    ${outputDir}`
);

console.log(
  '=============================================='
);

console.log('');

if (
  failed > 0
) {
  process.exit(1);
}