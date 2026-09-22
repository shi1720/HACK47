"""Bundle reviewed public deliverables; exclude working data and recording intermediates."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import json

root = Path(__file__).resolve().parents[1]
files = [root / "README.md", root / "LICENSE"]
for folder in ("docs", "submission"):
    files.extend(sorted((root / folder).glob("*.md")))
for folder in ("output/pdf", "output/presentation", "output/video"):
    files.extend(sorted(path for path in (root / folder).iterdir()
                        if path.is_file() and path.suffix in {".pdf", ".pptx", ".mp4", ".txt", ".json"}))
files.extend(sorted((root / "artifacts/screenshots").glob("*.png")))
files.extend(sorted((root / "artifacts").glob("*.json")))
files.extend(sorted((root / "artifacts").glob("*.pdf")))
files.extend(sorted((root / "submission/assets/fonts").iterdir()))
files.extend([root / "scripts/assemble-video.mjs"])
manifest = {
    str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest()
    for path in files
}
target = root / "output/batchlight-submission-kit.zip"
with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        archive.write(path, str(path.relative_to(root)))
    archive.writestr("SHA256SUMS.json", json.dumps(manifest, indent=2) + "\n")
with ZipFile(target) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f"Archive integrity check failed: {bad}")
print(f"Verified {target.name}: {len(files)} files, {target.stat().st_size:,} bytes")
