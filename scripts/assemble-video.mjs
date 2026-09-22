// Add the creator's actual narration to the prepared footage. Never synthesizes a voice.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const voice = process.argv[2];
const video = resolve('output/video/batchlight-demo-silent.mp4');
const output = resolve(process.argv[3] || 'output/video/batchlight-demo.mp4');
if (!voice || !existsSync(voice)) {
  console.error('Usage: node scripts/assemble-video.mjs path/to/shivam-voiceover.wav [output.mp4]');
  process.exit(1);
}
if (existsSync(output)) {
  console.error('Output already exists. Choose a new filename so an earlier edit is preserved.');
  process.exit(1);
}
function duration(path) {
  const result = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path], {
      encoding: 'utf8',
    }),
  );
  return Number(result.format.duration);
}
const pictureLength = duration(video),
  voiceLength = duration(resolve(voice));
if (!Number.isFinite(voiceLength) || voiceLength <= 0 || !Number.isFinite(pictureLength)) {
  throw new Error('Unable to determine recording duration.');
}
if (voiceLength > pictureLength) {
  throw new Error(
    `Narration is ${voiceLength.toFixed(1)}s; picture is ${pictureLength.toFixed(1)}s. Align or extend the footage before assembly. No narration was cut.`,
  );
}
mkdirSync(dirname(output), { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-n',
    '-i',
    video,
    '-i',
    resolve(voice),
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11,apad',
    '-shortest',
    '-movflags',
    '+faststart',
    output,
  ],
  { stdio: 'inherit' },
);
console.log(`Created ${output}. Review narration timing against all eight sections before publishing.`);
