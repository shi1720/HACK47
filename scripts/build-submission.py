"""Build the one-page Batchlight brief with ReportLab. Run with the bundled Python."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'submission/assets'
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('DM Sans', str(ASSETS/'fonts/DMSans.ttf')))
pdfmetrics.registerFont(TTFont('Instrument Serif', str(ASSETS/'fonts/InstrumentSerif-Regular.ttf')))
CREAM, FOREST, TERRA, MUTED = map(HexColor, ['#f7f6f0','#183e36','#d45a38','#62736b'])
W,H=595.28,841.89
c=canvas.Canvas(str(OUT/'batchlight-one-pager.pdf'),pagesize=(W,H))
c.setTitle('Batchlight - recall rehearsal for small food makers')
c.setAuthor('Shivam Gupta')
c.setSubject('HACK47 OFFGRID project brief. Synthetic demonstration and commercial hypotheses.')
c.setFillColor(CREAM);c.rect(0,0,W,H,fill=1,stroke=0)

def text(value,x,y,size=11,font='DM Sans',color=FOREST):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,H-y,value)

def para(value,x,y,w,size=10.5,leading=15,color=FOREST):
 style=ParagraphStyle('p',fontName='DM Sans',fontSize=size,leading=leading,textColor=color,alignment=TA_LEFT,spaceBefore=0,spaceAfter=0)
 p=Paragraph(value,style);_,ph=p.wrap(w,H);p.drawOn(c,x,H-y-ph);return ph

text('BATCHLIGHT',40,47,10,color=MUTED)
text('See what your',40,107,42,'Instrument Serif')
text('records prove,',40,151,42,'Instrument Serif')
text("and what they don't.",40,195,42,'Instrument Serif',TERRA)
para('Recall rehearsal for small food makers. Follow ingredient lots through production to customer shipments, with incomplete evidence in plain sight.',42,217,505,12.5,18)

text('THE MOMENT',42,294,9,color=MUTED)
para('A supplier flags smoked paprika lot PAP-2409. The sauce maker has cooked a base, filled several runs, and shipped some jars. One spice entry is missing. Batchlight shows what the records support and what still needs investigation.',42,307,506,11,16)

text('480',42,416,38,'Instrument Serif',TERRA)
text('120',225,416,38,'Instrument Serif')
text('240',407,416,38,'Instrument Serif',MUTED)
para('Recorded connection<br/>300 shipped, 180 on hand',43,434,164,10,14)
para('Needs investigation<br/>Incomplete input record',226,434,164,10,14)
para('No recorded connection<br/>This does not mean safe',408,434,151,10,14)
para('Synthetic Ember &amp; Oak demo. Counts are finished jars. Bulk intermediate material is separate.',43,480,505,8.7,12,MUTED)

text('WHY IT WORKS',42,530,9,color=MUTED)
para('Missing inputs carry uncertainty into downstream batches. Recovered source-lot evidence changes the live scope while an earlier rehearsal keeps its original basis. The public demo runs on the device. The full self-hosted app adds private accounts and validated offline synchronization.',42,544,506,10.6,15.5)

text('A BUSINESS HYPOTHESIS',42,637,9,color=MUTED)
para('Start with independent sauce makers supplying retail or wholesale customers. Test a $29/month hosted plan after five observed rehearsals with producers. Free local rehearsal is the entry point. No customers, revenue, or validated demand are claimed.',42,651,506,10.6,15.5)

text('Shivam Gupta - creator and product owner',42,750,11)
para('Built with substantial AI assistance. Traceability and rehearsal support, without a food-safety or compliance guarantee.',42,763,506,8.5,12,MUTED)
text('github.com/shi1720/HACK47',42,812,10)
c.linkURL('https://github.com/shi1720/HACK47',(42,H-815,250,H-800),relative=0)
text('HACK47: OFFGRID 2026',423,812,8,color=MUTED)
c.showPage();c.save()
print(OUT/'batchlight-one-pager.pdf')
