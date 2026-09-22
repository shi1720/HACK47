/** Rebuild the editable deck with the Codex bundled artifact-tool runtime.
 * Set CODEX_ARTIFACT_NODE_MODULES and CODEX_PRESENTATION_SKILL if installed elsewhere.
 * This script intentionally leaves validation receipts and draft renders in submission/.build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = process.env.CODEX_ARTIFACT_NODE_MODULES || '/Users/shivamgupta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.RUNTIME_NODE_MODULES = modules;
const skill = process.env.CODEX_PRESENTATION_SKILL || '/Users/shivamgupta/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations';
const python = process.env.CODEX_ARTIFACT_PYTHON || '/Users/shivamgupta/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const runtimeRequire = createRequire(path.join(modules, '__resolve__.cjs'));
const artifactRequire = createRequire(runtimeRequire.resolve('@oai/artifact-tool'));
const { FileBlob, Presentation, PresentationFile } = await import(pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const fonts = path.join(root, 'submission/assets/fonts');
for (const pkg of ['skia-canvas', '@napi-rs/canvas']) {
  try {
    const lib = pkg === 'skia-canvas' ? artifactRequire(pkg) : runtimeRequire(pkg);
    if (lib.FontLibrary) {
      lib.FontLibrary.use('DM Sans', [path.join(fonts, 'DMSans.ttf')]);
      lib.FontLibrary.use('Instrument Serif', [path.join(fonts, 'InstrumentSerif-Regular.ttf')]);
    }
    if (lib.GlobalFonts) {
      lib.GlobalFonts.registerFromPath(path.join(fonts, 'DMSans.ttf'), 'DM Sans');
      lib.GlobalFonts.registerFromPath(path.join(fonts, 'InstrumentSerif-Regular.ttf'), 'Instrument Serif');
    }
  } catch {}
}
const tmp = path.join(root, 'submission/.build');
await fs.mkdir(tmp, {recursive:true});
await fs.mkdir(path.join(root, 'output/presentation'), {recursive:true});
const p = Presentation.create({slideSize:{width:1280,height:720}});
const C = {cream:'#F7F6F0',forest:'#183E36',terra:'#D45A38',muted:'#62736B',soft:'#D7E1D8',white:'#FFFFFF'};
function tx(s,text,x,y,w,h,size=30,opts={}) {
  const shape=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  shape.text=text;
  shape.text.style={typeface:opts.serif?'Instrument Serif':'DM Sans',fontSize:size,color:opts.color||C.forest,bold:!!opts.bold,alignment:opts.align||'left',verticalAlignment:'top',insets:{left:0,top:0,right:0,bottom:0},autoFit:'none'};
  return shape;
}
function slide(n,title,opts={}) {
  const s=p.slides.add();s.background.fill=opts.dark?C.forest:C.cream;
  if(title)tx(s,title,64,52,1140,96,52,{serif:true,color:opts.dark?C.cream:C.forest});
  tx(s,'Batchlight',64,669,400,24,17,{color:opts.dark?C.soft:C.muted});
  tx(s,String(n).padStart(2,'0'),1160,669,56,24,17,{color:opts.dark?C.soft:C.muted,align:'right'});
  return s;
}
function notes(s,text){s.speakerNotes.textFrame.setText(text);}
const disclosure='All Ember & Oak records and quantities are synthetic. Batchlight does not determine food safety or certify compliance.';

{
 const s=slide(1,'');
 tx(s,'Batchlight',64,105,1140,138,112,{serif:true});
 tx(s,'Recall rehearsal for small food makers',70,265,1070,64,38);
 tx(s,'See what your records prove,\nand what they don’t.',70,375,1010,195,48,{serif:true,color:C.terra});
 tx(s,'Shivam Gupta  /  HACK47: OFFGRID 2026',70,619,1100,27,21);
 notes(s,'Shivam Gupta is project creator and product owner. Built with substantial AI assistance for research, design, implementation, testing, and writing. This deck presents a working hackathon product and an unvalidated commercial hypothesis. Source repository: https://github.com/shi1720/HACK47');
}
{
 const s=slide(2,'The supplier message');
 tx(s,'“Please investigate paprika lot PAP-2409.”',64,170,1130,140,66,{serif:true,color:C.terra});
 tx(s,'The maker has already cooked a base sauce,\nfilled several runs, and shipped some jars.',68,333,1050,110,35);
 tx(s,'One production sheet has a missing spice entry.',68,482,1080,72,35,{bold:true});
 tx(s,'Synthetic scenario. The uncertainty is the point of the rehearsal.',68,583,1050,44,23,{color:C.muted});
 notes(s,'Opening story is fictional and uses the synthetic Ember & Oak fixture. PAP-2409 flows into BASE-1809, then three finished batches. CHL-1909-X has an incomplete spice record. No customer incident is represented. '+disclosure);
}
{
 const s=slide(3,'A trace you can inspect');
 const screenshot = process.env.BATCHLIGHT_SCREENSHOT || path.join(root,'submission/assets/recall-workspace.png');
 try {
   const blob=await fs.readFile(screenshot);
   s.images.add({blob:new Uint8Array(blob),contentType:'image/png',alt:'Working Batchlight recall workspace with synthetic PAP-2409 trace results',fit:'contain',position:{left:64,top:150,width:1152,height:453}});
 } catch {
   tx(s,'PAP-2409',64,175,1130,100,70,{serif:true,color:C.terra});
   tx(s,'Smoked paprika, recorded into mother sauce\nand then into three finished production runs.',68,304,1070,126,38);
   tx(s,'300 jars shipped. 180 jars remain on hand.',68,479,1080,88,39,{bold:true});
 }
 tx(s,'Synthetic records. Source references remain available throughout the trace.',68,620,1080,36,21,{color:C.muted});
 notes(s,'The screenshot, when present, is captured from the real Batchlight interface with synthetic records. The recorded path starts at PAP-2409, passes through BASE-1809, and reaches three finished runs totalling 480 units. Recorded shipments total 300 units to three synthetic customers. The remaining 180 units are on hand. Do not treat these figures as customer outcomes. '+disclosure);
}
{
 const s=slide(4,'Three answers, with honest limits');
 const rows=[['480','Recorded connection','The records contain a path from this lot.',C.terra],['120','Needs investigation','A missing input leaves a possible connection unresolved.',C.forest],['240','No recorded connection','No path appears in these records. This does not mean safe.',C.muted]];
 rows.forEach((r,i)=>{let y=178+i*139;tx(s,r[0],67,y,260,100,82,{serif:true,color:r[3]});tx(s,r[1],361,y+7,810,51,34,{bold:true});tx(s,r[2],363,y+63,810,64,25,{color:C.muted});});
 tx(s,'Finished jars in the synthetic demonstration. Intermediate bulk quantities are separate.',68,623,1100,33,20,{color:C.muted});
 notes(s,'Classification is based on stored records. The trace engine preserves explicitly incomplete records and propagates uncertainty through downstream production. A recorded connection does not establish contamination. A missing connection does not establish safety. Quantities are synthetic fixture outputs, not field measurements. '+disclosure);
}
{
 const s=slide(5,'New evidence changes the live scope',{dark:true});
 tx(s,'Before the missing entry is resolved',66,173,1110,60,32,{bold:true,color:C.cream});
 tx(s,'120 jars need investigation',66,252,1110,74,51,{serif:true,color:C.soft});
 tx(s,'The maker adds a source reference confirming PAP-2410.',66,354,1110,67,29,{color:C.cream});
 tx(s,'The current trace shows no recorded connection\nfor those 120 jars. It still makes no safety judgment.',66,437,1110,116,33,{color:C.cream});
 tx(s,'The earlier saved rehearsal retains the original uncertainty.',66,594,1120,49,27,{color:C.soft});
 notes(s,'Synthetic evidence-repair demonstration. Save a PAP-2409 rehearsal before resolving the incomplete input in CHL-1909-X to a different supplier lot, PAP-2410. The earlier snapshot remains unchanged. The live investigation group then drops from 120 to 0 finished units, while the no-recorded-connection group grows from 240 to 360. No safety claim follows. The public GitHub Pages demo runs on the device. The full self-hosted application adds isolated accounts, transactional server validation, revision checks, idempotent commands, and queued offline synchronization. A stale pending rehearsal preserves its original device snapshot and pauses for reconciliation rather than silently recomputing. See repository tests. No claim that competitors lack equivalent workflows.');
}
{
 const s=slide(6,'A focused place in an existing market');
 tx(s,'Traceability software already exists.',67,176,1100,73,42,{serif:true,color:C.terra});
 tx(s,'Lotpath and LotThread already sell recall drills.\nStocksmith and FourFoxes serve the same makers.',68,282,1100,115,31);
 tx(s,'Our product hypothesis',68,427,1110,46,24,{bold:true});
 tx(s,'A maker will value closing a record gap without\nlosing its history. New evidence updates the live\nscope, while earlier reports keep their original basis.',68,490,1110,143,31);
 notes(s,'Competitor primary sources checked 22 September 2026: https://lotpath.tekinworks.com/ ; https://lotthread.com/pricing/ ; https://stocksmith.io/pricing/ ; https://fourfoxes.io/ . These sources describe vendor capabilities, not independent test results. We have not tested private competitor applications and do not claim they lack unlisted features. The differentiation and willingness to switch are hypotheses, not validated findings.');
}
{
 const s=slide(7,'A price worth testing');
 tx(s,'$29',65,190,485,158,126,{serif:true,color:C.terra});
 tx(s,'per producer / month',72,361,489,54,29);
 tx(s,'Proposed hosted plan',72,432,489,52,24,{bold:true});
 tx(s,'Free local rehearsal\nNo payments implemented',72,503,500,100,26,{color:C.muted});
 tx(s,'A narrow first customer',661,188,550,55,30,{bold:true});
 tx(s,'An owner-operated sauce maker\nsupplying a few retail or\nwholesale customers.',661,267,550,125,31);
 tx(s,'Economics hypothesis',661,449,550,50,27,{bold:true});
 tx(s,'$19.83 monthly contribution\nunder stated cost assumptions.\nSupport time is the biggest risk.',661,519,550,111,27,{color:C.muted});
 notes(s,'All money is in US dollars and is hypothetical. Proposed monthly revenue $29 less $3 allocated infrastructure/backups, assumed payment cost 3%+$0.30 ($1.17), and 10 minutes of support at $30/hour ($5) gives $19.83 before acquisition, engineering, tax, and overhead. With 30 minutes of support it falls to $9.83. Not a provider quote or forecast. No customers, revenue, payment integration, or validated willingness to pay. See docs/BUSINESS.md.');
}
{
 const s=slide(8,'The next proof comes from makers');
 tx(s,'5 observed rehearsals',66,172,1140,91,66,{serif:true,color:C.terra});
 tx(s,'Use consenting producers’ own records.',68,286,1120,60,34);
 tx(s,'Measure correct recipients, unresolved evidence,\nsetup burden, repeated use, and support time.',68,369,1120,113,32);
 tx(s,'Offer a paid pilot only after the workflow earns trust.',68,533,1130,74,33,{bold:true});
 tx(s,'Planned validation. No customer interviews or paid pilots have taken place.',68,621,1130,32,20,{color:C.muted});
 notes(s,'Proposed decision gates: three of five target makers complete a rehearsal with their own records, two accept a paid pilot, and no critical false exclusions emerge. These are planned thresholds, not results. A five-person study does not establish market demand. Before operational use, perform independent security review, hosted backup-restore verification, and qualified food-safety workflow review.');
}
{
 const s=slide(9,'',{dark:true});
 tx(s,'A recall should not be\nthe first time you test\nyour records.',66,120,1147,327,83,{serif:true,color:C.cream});
 tx(s,'Batchlight',69,485,1120,77,51,{serif:true,color:C.soft});
 tx(s,'github.com/shi1720/HACK47',70,589,1080,46,29,{color:C.cream});
 notes(s,'Creator and product owner: Shivam Gupta. Built with substantial AI assistance for research, design, implementation, testing, and writing. Complete disclosure in docs/THIRD-PARTY.md. Demonstration data is synthetic. Batchlight supports traceability and rehearsal but does not detect contamination, determine food safety, or certify legal compliance.');
}

const candidate=path.join(tmp,'batchlight-candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
let final=path.join(root,'output/presentation/batchlight-pitch.pptx');
try {await fs.access(final); final=path.join(root,`output/presentation/batchlight-pitch-${Date.now()}.pptx`);} catch {}
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:final,pythonExecutable:python,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:9,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['DM Sans','Instrument Serif']},verifyArtifactToolImport:true,receiptPath:path.join(tmp,path.basename(final)+'.validation.json')});
const verified=await PresentationFile.importPptx(await FileBlob.load(final));
for(let i=0;i<verified.slides.items.length;i++){
 const rendered=await verified.export({slide:verified.slides.items[i],format:'png',scale:1.5});
 await fs.writeFile(path.join(tmp,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await rendered.arrayBuffer()));
}
await fs.writeFile(path.join(tmp,'deck-build-result.json'),JSON.stringify({final,result},null,2));
console.log(final);
