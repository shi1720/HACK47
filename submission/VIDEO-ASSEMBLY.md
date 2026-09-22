# Finish the demo video

The primary story is a real application recording: trace the suspect lot, preserve an uncertain rehearsal, repair the missing record, then open the earlier report. Use the word-for-word narration and click sequence in `DEMO-SCRIPT.md`. Do not replace the working application with animated mockups.

## Capture and narration

1. Use the actual screen recording delivered with the project, or capture a fresh session using the script. Keep the synthetic-data banner visible. Capture the full application for any account or synchronization segment; GitHub Pages runs only the browser demo.
2. Review the recording before speaking. If it was captured faster than the roughly three-minute narration, add holds at the important result screens in an editor. Keep typing and loading at normal speed where it helps show actual behavior. Never label edited footage as a measured speed benchmark.
3. Record Shivam reading only the narration blocks in a quiet room. Place the microphone consistently, leave a second of silence before each section, and keep a natural pace. Export a WAV file. Redo an unclear sentence rather than attempting to remove individual words.
4. Align the seven spoken sections with the shot list. Leave enough time to read the 480 / 300 / 180 metrics, distinguish the investigation group, and inspect the earlier PDF after the repair. Keep that final comparison visible while explaining it.
5. Use a small, readable on-screen label for the footage source: **Full application · synthetic data** or **Browser-only demo · synthetic data**. Do not put a simulated account badge over browser-only footage.

## Assemble with FFmpeg

FFmpeg is an optional local video tool; it is not a runtime dependency of Batchlight. The following example assumes the screen recording has already been edited to match the voiceover and is at least as long as the narration. Replace the input paths with the actual files. It preserves the screen recording's full duration and pads a shorter voice track with silence.

```sh
ffmpeg -i batchlight-screen.webm -i shivam-voiceover.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11,apad" \
  -shortest -movflags +faststart batchlight-demo.mp4
```

The command omits any screen-recording audio and uses the voiceover. If narration is longer than the picture, extend the picture first; `-shortest` otherwise cuts the narration at the video's end. Do not use the command to hide a failed or incomplete action.

Check the encoded duration and streams:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height \
  -of default=noprint_wrappers=1 batchlight-demo.mp4
```

If an editor can export an MP4 with H.264 video, AAC audio, and readable 1080p picture, that is equally suitable. The pitch deck is editable and can supply the short price-hypothesis and closing shots; export those slides locally before inserting them.

## Captions and publishing

Create captions from the final audio, then manually correct **Batchlight**, **PAP-2409**, **PAP-2410**, and the quantities. The script is a starting transcript; do not reuse its approximate time markers as caption timing. Upload the finished video to a platform accepted by the organizer with public or unlisted access as appropriate.

Watch the uploaded video from a logged-out browser, with headphones and again with captions only. Confirm the report is readable, speech is intelligible, the whole ending plays, and no password, recovery code, personal notification, or private customer record is visible. Paste the resulting public link into Devpost only after this check. A local MP4 or silent screen capture is not itself a public demo-video URL.
