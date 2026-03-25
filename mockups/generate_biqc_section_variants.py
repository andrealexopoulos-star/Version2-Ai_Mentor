from PIL import Image, ImageDraw, ImageFont
import textwrap

OUT_DIR = 'C:/Users/andre/.cursor/worktrees/Version2-Ai_Mentor/yms/mockups'

try:
    f_title = ImageFont.truetype('arialbd.ttf', 72)
    f_sub = ImageFont.truetype('arial.ttf', 30)
    f_h = ImageFont.truetype('arialbd.ttf', 36)
    f_body = ImageFont.truetype('arial.ttf', 24)
    f_small = ImageFont.truetype('arial.ttf', 19)
except:
    f_title = ImageFont.load_default(); f_sub = f_title; f_h = f_title; f_body = f_title; f_small = f_title

trust = [
    ('Security-first by default', 'Encrypted in transit and at rest, role-based access, audit-ready records.'),
    ('Explainable machine learning', 'Every recommendation includes evidence, confidence, and reasoning context.'),
    ('Human in control', 'Teams approve actions; BIQc accelerates decisions without removing leadership control.'),
]

def draw_wrapped(draw, text, x, y, width_chars, font, fill, line_h):
    lines = textwrap.wrap(text, width=width_chars)
    for i, line in enumerate(lines[:3]):
        draw.text((x, y + i*line_h), line, font=font, fill=fill)


def variant_minimal(path):
    W, H = 1400, 920
    img = Image.new('RGB', (W, H), '#071423')
    d = ImageDraw.Draw(img)

    d.text((110, 82), 'How it all works', font=f_title, fill='#F4F7FA')
    d.text((110, 175), 'A clear, low-friction intelligence flow for leaders.', font=f_sub, fill='#9FB0C3')

    # Simple horizontal flow
    x0, y0 = 120, 300
    cards = [
        ('Connected Systems', 'Finance, sales, ops, marketing'),
        ('Watchtower', 'Continuous monitoring and alerts'),
        ('BIQc Core', 'Evidence + ML + context + confidence'),
        ('Decision Support', 'Prioritized actions and next steps'),
    ]
    cw, ch, gap = 285, 120, 24
    for i, (h, b) in enumerate(cards):
        x = x0 + i*(cw+gap)
        border = '#C96A36' if h == 'BIQc Core' else '#2F5374'
        fill = '#15253A' if h == 'BIQc Core' else '#0F2135'
        d.rounded_rectangle((x, y0, x+cw, y0+ch), radius=18, outline=border, width=2, fill=fill)
        d.text((x+18, y0+20), h, font=f_h, fill='#FF9C45' if h == 'BIQc Core' else '#F4F7FA')
        d.text((x+18, y0+70), b, font=f_small, fill='#9FB0C3')
        if i < len(cards)-1:
            ax = x + cw + 8
            ay = y0 + ch//2
            d.line((ax, ay, ax+16, ay), fill='#FF8C28', width=3)
            d.polygon([(ax+16, ay), (ax+10, ay-5), (ax+10, ay+5)], fill='#FF8C28')

    # Trust strip
    d.rounded_rectangle((90, 695, 1310, 875), radius=18, outline='#2F5374', width=2, fill='#0B1D31')
    for i, (h, b) in enumerate(trust):
        x = 125 + i*400
        d.text((x, 730), h, font=f_body, fill='#F4F7FA')
        draw_wrapped(d, b, x, 770, 32, f_small, '#9FB0C3', 28)

    img.save(path)


def variant_premium(path):
    W, H = 1400, 920
    img = Image.new('RGB', (W, H), '#061226')
    d = ImageDraw.Draw(img)

    # ambient layered glows
    for r, col in [(760, (14, 38, 64)), (620, (16, 42, 71)), (450, (20, 47, 80))]:
        d.ellipse((W//2-r, 80-r//2, W//2+r, 80+r//2), fill=col)

    d.text((110, 76), 'How it all works', font=f_title, fill='#F4F7FA')
    d.text((110, 170), 'Sophisticated intelligence, delivered with clarity and trust.', font=f_sub, fill='#AFC0D4')

    # top signal cards
    signals = ['Finance', 'Sales', 'Operations', 'Marketing']
    y = 280
    for i, s in enumerate(signals):
        x = 130 + i*315
        d.rounded_rectangle((x, y, x+285, y+92), radius=16, outline='#345C7F', width=2, fill='#0E2136')
        d.text((x+18, y+16), f'{s} Signals', font=f_body, fill='#FF9C45')
        d.text((x+18, y+50), 'Connected and continuously synced', font=f_small, fill='#9FB0C3')

    # vertical premium stack
    stack = [
        ('Watchtower Monitoring', 'Continuous anomaly and risk detection', '#36587A', '#10243A', '#F4F7FA'),
        ('BIQc Intelligence Core', 'Evidence + machine learning + context + confidence', '#D4763C', '#17283F', '#FF9C45'),
        ('Decision Support', 'Prioritized recommendations with confidence cues', '#36587A', '#10243A', '#F4F7FA'),
    ]
    ys = [400, 530, 660]
    for (title, body, border, fill, hcol), yy in zip(stack, ys):
        d.rounded_rectangle((320, yy, 1080, yy+105), radius=22, outline=border, width=2, fill=fill)
        d.text((350, yy+20), title, font=f_h, fill=hcol)
        d.text((350, yy+65), body, font=f_body, fill='#A8B8CB')

    # connectors with dots
    for y1, y2 in [(372, 400), (505, 530), (635, 660)]:
        d.line((700, y1, 700, y2), fill='#FF8C28', width=3)
        d.ellipse((694, y2-8, 706, y2+4), fill='#FF8C28')

    d.rounded_rectangle((80, 770, 1320, 900), radius=18, outline='#345C7F', width=2, fill='#0A1D31')
    for i, (h, b) in enumerate(trust):
        x = 118 + i*408
        d.text((x, 800), h, font=f_body, fill='#F4F7FA')
        draw_wrapped(d, b, x, 838, 36, f_small, '#9FB0C3', 26)

    img.save(path)


minimal_path = f'{OUT_DIR}/biqc-how-it-works-minimal-mockup.png'
premium_path = f'{OUT_DIR}/biqc-how-it-works-premium-mockup.png'
variant_minimal(minimal_path)
variant_premium(premium_path)
print(minimal_path)
print(premium_path)
