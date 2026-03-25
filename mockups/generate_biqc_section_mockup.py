from PIL import Image, ImageDraw, ImageFont
import textwrap

W, H = 1400, 920
img = Image.new('RGB', (W, H), '#071629')
d = ImageDraw.Draw(img)

for r in [640, 520, 420, 320]:
    bbox = (W//2-r, 120-r//2, W//2+r, 120+r//2)
    d.ellipse(bbox, fill=(20, 45, 72))

try:
    f_title = ImageFont.truetype('arialbd.ttf', 70)
    f_sub = ImageFont.truetype('arial.ttf', 28)
    f_h = ImageFont.truetype('arialbd.ttf', 34)
    f_body = ImageFont.truetype('arial.ttf', 24)
    f_small = ImageFont.truetype('arial.ttf', 18)
except:
    f_title = ImageFont.load_default(); f_sub = f_title; f_h = f_title; f_body = f_title; f_small=f_title

x_pad = 110
d.text((x_pad, 75), 'How it all works', font=f_title, fill='#F4F7FA')
d.text((x_pad, 165), 'BIQc connects your systems, monitors change continuously, and turns live evidence into', font=f_sub, fill='#9FB0C3')
d.text((x_pad, 200), 'clear leadership decisions with explainable recommendations.', font=f_sub, fill='#9FB0C3')

chips = ['Finance Systems', 'Sales Systems', 'Operations Systems', 'Marketing Systems']
cx, cy = x_pad, 280
for i, c in enumerate(chips):
    w = 280
    x = cx + i*(w+18)
    d.rounded_rectangle((x, cy, x+w, cy+88), radius=16, outline='#2C4B68', width=2, fill='#0C1F33')
    d.text((x+18, cy+15), c, font=f_body, fill='#FF9C45')
    d.text((x+18, cy+50), 'Connected and normalized', font=f_body, fill='#9FB0C3')

blocks = [
    ('Watchtower Monitoring', 'Continuous anomaly and risk detection', 390),
    ('BIQc Intelligence Core', 'Evidence + models + context + confidence', 510),
    ('Decision Support', 'Prioritized actions and trade-off guidance', 635),
]
for title, desc, y in blocks:
    x1, x2 = 340, 1060
    fill = '#101F32' if 'Core' not in title else '#16253A'
    border = '#36587A' if 'Core' not in title else '#C96A36'
    d.rounded_rectangle((x1, y, x2, y+92), radius=20, outline=border, width=2, fill=fill)
    d.text((x1+24, y+16), title, font=f_h, fill='#F4F7FA' if 'Core' not in title else '#FF9C45')
    d.text((x1+24, y+56), desc, font=f_body, fill='#9FB0C3')

for y1,y2 in [(368,390),(482,510),(602,635)]:
    d.line((700, y1, 700, y2), fill='#FF8C28', width=3)
    d.ellipse((694, y2-8, 706, y2+4), fill='#FF8C28')

d.rounded_rectangle((95, 748, 1305, 895), radius=18, outline='#2C4B68', width=2, fill='#0B1C2E')
trust = [
    ('Security-first by default', 'Encrypted in transit and at rest, role-based access, audit-ready records.'),
    ('Explainable machine learning', 'Every recommendation includes evidence, confidence, and reasoning context.'),
    ('Human in control', 'Teams approve actions; BIQc accelerates decisions without removing leadership control.'),
]
col_w = 360
for i,(h,b) in enumerate(trust):
    x = 130 + i*(col_w+35)
    d.text((x, 775), h, font=f_body, fill='#F4F7FA')
    lines = textwrap.wrap(b, width=42)
    y = 812
    for line in lines[:2]:
        d.text((x, y), line, font=f_small, fill='#9FB0C3')
        y += 26

out = 'C:/Users/andre/.cursor/worktrees/Version2-Ai_Mentor/yms/mockups/biqc-how-it-works-trust-mockup.png'
img.save(out)
print(out)
