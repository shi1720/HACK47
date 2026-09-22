# Batchlight demo recording

**Target:** roughly 3 minutes at a calm 140-150 words per minute. Read only the narration blocks aloud. Timing is a recording guide, not a product performance claim. Use a real application session at normal speed.

The prepared screen recording is `output/video/batchlight-demo-silent.mp4`. Its matching narration is `output/video/voiceover-verbatim.txt` (383 words in eight sections). Use that text when voicing the prepared recording; the click sequence below also supports a fresh recording. The screen recording uses the full local application with synthetic records.

## Before recording

1. For the full application, run `npm ci` and `npm run dev`, then open `http://localhost:5180` (API port 3087). Use a 1440-by-900 or 1920-by-1080 browser window at 100% zoom. Hide personal tabs and notifications. The live public `https://shi1720.github.io/HACK47/` build is browser-only and can demonstrate the core rehearsal story. It cannot demonstrate account login or server synchronization.
2. Open the landing page in a clean browser session. Click **Explore the live demo** to confirm the demo works, then begin a fresh demo for the recording. The fixture is entirely synthetic.
3. Confirm the PAP-2409 trace shows 480 connected finished units, 300 delivered, 180 still in the kitchen, and one batch needing investigation. In **Batch scope**, the investigation batch has 120 units and the separate lot batch has 240 units.
4. Test **Save this rehearsal**, **Save snapshot**, and **Download evidence pack**. Open the PDF before recording so the download location is predictable. Start a fresh demo again afterward.
5. Keep the deck available for the short closing shot. The video should spend most of its time inside the working application.
6. Record a brief audio test. Use your normal speaking voice. Add captions from the final recorded words. Leave a small pause between segments so edits do not cut sentences. For a silent screen recording, follow `submission/VIDEO-ASSEMBLY.md` to add Shivam's voiceover.

## Verbatim narration and shots

### 0:00-0:23 - The missing record

**Picture:** Landing page. Click **Explore the live demo**. Keep the synthetic-data notice visible.

> A sauce maker receives a supplier alert. One batch sheet is missing its spice entry. Are those jars connected, or have we simply lost the evidence? I’m Shivam Gupta, and this is Batchlight. See what your records prove, and what they don’t. Every business and record in this demonstration is synthetic.

### 0:23-0:46 - Follow the recorded path

**Clicks:** On the dashboard, click **Start a recall drill**. The selector should show **Smoked paprika · PAP-2409 · Red Earth Spices**. Keep **Traceability map** selected. Click the **SMK-1809-A** node to inspect its source reference and recorded path, then close the dialog.

> I select the supplier’s paprika lot. Batchlight follows the recorded connection through a mother sauce into three finished production runs. Clicking a batch shows the source reference and the path. A deterministic calculation produces this answer. A language model does not decide which batches are connected.

### 0:46-1:05 - The current scope

**Clicks:** Pause on the metrics, then click **Customer deliveries**. Show the three recorded customers and the separate investigation delivery.

> The records connect four hundred and eighty jars. Three hundred have shipped to three customers. One hundred and eighty remain on hand. The recipients are listed here. The uncertain delivery stays separate from those totals.

### 1:05-1:27 - The gap stays visible

**Clicks:** Click **Batch scope**. Show **CHL-1909-X** and **SMK-2009-A**. Inspect the chilli relish record's missing spice note, then close it.

> One hundred and twenty jars need investigation because the spice entry is missing. Uncertainty follows a batch into its descendants. Another two hundred and forty jars have no recorded connection to this lot. That phrase does not mean safe. Missing evidence must never become an all-clear.

### 1:27-1:46 - Save what was known

**Clicks:** Click **Save this rehearsal**. Keep the default title, reason, and **Rehearsal / drill (no real incident)** type. Click **Save snapshot**. On **Rehearsals & reports**, briefly select **Review snapshot**, then close it.

> I save a rehearsal now, while that evidence is still missing. This preserves the records behind the result. The report includes the investigation group, so someone reviewing it later can see what we actually knew at this point.

### 1:46-2:16 - Repair the evidence

**Clicks:** Return to the PAP-2409 trace. In **Batch scope**, inspect **CHL-1909-X**, then click **Resolve record gap**. Select **PAP-2410** in **Recovered input 1**, and enter **0.5** in **Recovered quantity 1** (kg). In **Recovered source reference**, enter: `Synthetic recovered production record EEO-1909-X: PAP-2410, 0.5 kg.` In **What did you verify?**, enter: `Synthetic training correction. The recovered spice entry completes this batch's ingredient records.` Check **I reviewed the original evidence and all input lots are now recorded.** Click **Save evidence & recheck**. Open **Evidence changes**. Under **New evidence. Original history.**, show CHL-1909-X side by side: needs investigation at the snapshot, no recorded connection in the current record, with the recovered reference visible.

> Now the maker recovers the missing record. It names a different paprika lot. I add that input and its source reference. Here are the old and current records side by side. These one hundred and twenty jars leave the investigation group. Their records now show no connection to the selected lot. That is a better-supported record, not a safety judgment.

### 2:16-2:39 - The old report stays honest

**Clicks:** Return to **Rehearsals & reports**. Click **Download evidence pack** on the original rehearsal. Open the PDF and show its investigation section, which must still include CHL-1909-X. Do not save a replacement report over it.

> The earlier report still contains the original uncertainty. New knowledge has not silently rewritten history. Its evidence pack includes source references and customer contact drafts. Nothing is sent automatically. The full self-hosted app also includes private accounts and validated offline synchronization. The public browser demo keeps its records on this device.

### 2:39-3:05 - The next test

**Picture:** Show slide 7 briefly, then the application or slide 9.

> Our first target is a small sauce maker supplying retailers. We propose a twenty-nine-dollar monthly hosted plan, with free local rehearsal. That is a pricing hypothesis. Next come five observed producer rehearsals and a paid pilot offer. I created Batchlight with substantial AI assistance. A recall should not be the first time you test your records.

## Optional extended proof shots

These are useful for a longer technical demo, judge questions, or a short insert. Run account and synchronization shots against the full server application, not GitHub Pages. Keep the main video focused if the organizer sets a strict duration limit.

### Account creation and recovery

Open **Start your workspace** from the landing page in a separate clean session. Enter a clearly fictional maker name, a controlled test email, a unique test passphrase of at least 12 characters, and a workspace name. Click **Create your workspace**. Save the recovery code privately. Never include a real password, session token, or recovery code in the final video. The new workspace should be empty and isolated from the synthetic demo. Sign out and use **Log in** to demonstrate persistence.

Suggested narration: “A maker can create a private workspace and return to saved records. Recovery uses a code that the maker stores privately.”

### Record entry and validation

In a fresh test workspace, receive a synthetic ingredient lot, record a batch using part of it, and log a delivery from the batch. Use the current form labels. Attempt a quantity larger than the remaining stock, then show the validation message and correct it. Do not change the PAP-2409 demo before filming the main story because its expected quantities would change.

Suggested narration: “Each write is checked against the existing records. An operation cannot consume more stock than its source contains.”

### Import

In a new empty account, open **Import a spreadsheet**, download the three sample templates, and select them together using **Choose files**. Show the validated preview before clicking **Import these records**. The templates contain synthetic rows. Existing records stay intact. Account metadata and historical reports are not restored by a record import.

Suggested narration: “Related spreadsheet files enter together, so their lot and batch references can be validated as one operation.”

### Offline and reconnect

Use an authenticated account in the production build. Load it once online, then take the browser offline. Record a clearly synthetic delivery within the available stock. Show the pending-sync indicator. Restore connectivity and wait for confirmation. Refresh to verify the server retained the record. If a conflict appears, show it honestly and preserve pending work before resolving it.

Suggested narration: “The device keeps this change while disconnected. After reconnection, the server checks it against the latest stock before it becomes authoritative.”

### Offline stock conflict

Use two separate browser profiles signed into the same disposable test account. Do not use two tabs that share the same device cache as a substitute for two independent devices.

1. Online, receive a synthetic **10 kg** ingredient lot with code **SYN-CONFLICT-01** and a source reference explaining this is a synchronization test.
2. Load both profiles so each has that same record. Disconnect profile A.
3. In profile A, record a bulk batch consuming **7 kg** from the lot, with a **7 kg** output and complete input records. Its write remains pending.
4. In online profile B, record a different bulk batch consuming **6 kg** from the same lot, with a **6 kg** output. Let it synchronize.
5. Reconnect A. Its stale request would allocate **13 kg** from a **10 kg** lot, so the server must reject it. Show the error and pending-work indicator. Do not claim successful synchronization.
6. Preserve the pending record with an export before discarding it. Refresh from the server and confirm the accepted **6 kg** operation leaves **4 kg** available.

Use distinct batch codes, a valid production date no earlier than the lot's receipt, and synthetic source references. This is a test setup, not a recipe.

Suggested narration: “Both devices once saw ten kilograms. One used six while the other was offline. The offline request for seven is rejected when it reconnects. The product keeps the conflict visible instead of silently creating thirteen kilograms of allocations.”

### A pending rehearsal meets newer records

Use two independent profiles on the same disposable server account. Load both online. Disconnect A and save a rehearsal there. In B, save a valid change to a production record or record a new delivery. Reconnect A. Its rehearsal must remain pending with its original snapshot, alongside a message that the server records changed. Export that PDF and the pending changes before choosing **Resolve by keeping the server copy** in **Workspace & data**. Only after preserving the old evidence, choose **Keep server copy** and create a fresh rehearsal from the current server records.

Suggested narration: “This review was saved while disconnected. Another device changed the records meanwhile. Batchlight preserves the original review and asks me to reconcile; it does not quietly recompute what I knew earlier.”

## Final video checklist

- Synthetic-data disclosure is audible and visible.
- The three recall states are legible and correctly explained.
- At least one source reference and an actual exported PDF appear on screen.
- No passwords, recovery codes, private records, or browser notifications appear.
- No invented customer quote, measured speedup, revenue, or compliance guarantee appears.
- Browser-only footage is labeled as such; account and server-sync evidence comes from the full application.
- Upload the finished video and verify it plays without requiring access to your personal account.
- Paste the resulting public URL into the Devpost video field. Do not submit a script as the video.
