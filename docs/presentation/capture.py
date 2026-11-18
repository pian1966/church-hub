"""Church Hub - screenshots and short clips for the conference presentation (docs/presentation/).

Everything comes from the demo (made-up people), shown as "Grace Community Church". Needs Python Playwright
(pip install playwright && playwright install chromium), Pillow and ffmpeg, with the app served locally:

    python3 -m http.server 8765          # in the repository folder
    python3 docs/presentation/capture.py # writes docs/presentation/img/
    cd docs/presentation && node build.js  # builds church-hub-presentation.pptx

The clips are animated GIFs (Google Slides plays GIFs; it drops videos when a .pptx is converted).
"""
import glob, os, shutil, subprocess, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/?demo'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img')
TMP = tempfile.mkdtemp(prefix='ch-capture-')
HIDE = ".demo{display:none!important} #jump{display:none!important} .toast,#toast{display:none!important}"
HIDE_JS = "document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '" + HIDE + "'; document.head.appendChild(s); })"


def sign_in(pg, who):
    pg.goto(BASE); pg.wait_for_timeout(1500)
    pg.click('[data-act="hub:signin"][data-id="' + who + '"]'); pg.wait_for_timeout(900)
    pg.evaluate("() => Store.setSettings({ churchName: 'Grace Community Church' })")


def go(pg, route, wait=900):
    pg.goto(BASE + '#/' + route); pg.wait_for_timeout(wait); pg.evaluate("() => window.scrollTo(0, 0)")


def fill_roster(pg):
    """Fill the gaps and keep them: volunteers are asked in Messages (so a member has something to accept)."""
    go(pg, 'rosters'); pg.click('[data-act="rosters:autofill"]'); pg.wait_for_timeout(700)
    pg.click('[data-act="rosters:keep"]'); pg.wait_for_timeout(1200)


def be(pg, who, route):
    """Switch to another demo person in the same browser (the demo keeps its data in this browser)."""
    if not pg.url.startswith('http'): pg.goto(BASE); pg.wait_for_timeout(1200)
    pg.evaluate("w => sessionStorage.setItem('hub_user', w)", who); go(pg, route); pg.reload(); pg.wait_for_timeout(1500)
    if pg.is_visible('[data-act="hub:signin"][data-id="' + who + '"]'): pg.click('[data-act="hub:signin"][data-id="' + who + '"]'); pg.wait_for_timeout(900)


def jpg(src, name, crop=None, w=1600):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.jpg'), quality=88, optimize=True)


def gif(src, name, start, width):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(start), '-i', src, '-vf',
                    'fps=10,scale=%d:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle' % width,
                    '-loop', '0', os.path.join(OUT, name + '.gif')], check=True)


def record(b, name, steps, w=1280, h=720):
    d = os.path.join(TMP, 'rec-' + name)
    ctx = b.new_context(viewport={'width': w, 'height': h}, record_video_dir=d, record_video_size={'width': w, 'height': h})
    ctx.add_init_script(HIDE_JS)
    pg = ctx.new_page(); sign_in(pg, 'p01'); steps(pg); pg.close(); ctx.close()
    return glob.glob(d + '/*.webm')[0]


os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- still screens: an Administrator on a computer, a Church Partner on a phone ----
    ctx = b.new_context(device_scale_factor=2); ctx.add_init_script(HIDE_JS)
    d = ctx.new_page(); d.set_viewport_size({'width': 1440, 'height': 900}); sign_in(d, 'p01')
    go(d, 'home')
    if d.is_visible('[data-act="hub:later"][data-k="langs"]'): d.click('[data-act="hub:later"][data-k="langs"]')
    fill_roster(d)
    d.evaluate("""() => { const ps = Store.list('people').filter(p => p.active !== false && p.familyRole !== 'child');
      Store.put('messages', { kind: 'partners', groupId: '', audience: '', title: 'Harvest lunch this Sunday', body: 'Please bring a plate of food to share after the 10am service. Everyone is welcome – invite a friend!',
        fromId: 'p02', fromName: 'Thandi Mokoena', to: ps.map(p => p.id).filter(id => id !== 'p02'), deliveredBy: ['p02'], readBy: ['p02'] }); }""")
    for route, name, crop in [('home', 'd-home', None), ('people', 'd-people-c', (464, 0, 2880, 1500)), ('rosters', 'd-roster-c', (464, 0, 2880, 1500)),
                              ('settings/apps', 'd-apps-c', (464, 0, 2880, 1800)), ('privacy', 'd-privacy', None), ('rosters/services', 'd-services', None), ('messages', 'd-messages', None)]:
        go(d, route); f = os.path.join(TMP, name + '.png'); d.screenshot(path=f); jpg(f, name, crop)
    ph = ctx.new_page(); ph.set_viewport_size({'width': 390, 'height': 844}); be(ph, 'p09', 'home')
    for route, name in [('home', 'm-home'), ('me', 'm-me'), ('messages', 'm-messages'), ('rosters/mine', 'm-serving'), ('people', 'm-directory')]:
        go(ph, route); f = os.path.join(TMP, name + '.png'); ph.screenshot(path=f); jpg(f, name, w=700)
    ctx.close()
    # dark mode, and isiZulu
    for name, scheme, lang, route in [('m-dark', 'dark', None, 'home'), ('m-zulu', 'light', 'zu', 'me')]:
        c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, color_scheme=scheme); c.add_init_script(HIDE_JS)
        pg = c.new_page(); sign_in(pg, 'p01'); fill_roster(pg); be(pg, 'p09', route)
        if lang: pg.evaluate("l => { I18n.set(l); if (Hub.render) Hub.render(); }", lang); pg.wait_for_timeout(1200)
        go(pg, route); pg.wait_for_timeout(600); f = os.path.join(TMP, name + '.png'); pg.screenshot(path=f); jpg(f, name, w=700); c.close()

    # ---- clip: Fill the gaps for me ----
    def fill(pg):
        go(pg, 'rosters', 1200); pg.hover('[data-act="rosters:autofill"]'); pg.wait_for_timeout(700)
        pg.click('[data-act="rosters:autofill"]'); pg.wait_for_timeout(2200)
        pg.hover('[data-act="rosters:keep"]'); pg.wait_for_timeout(700); pg.click('[data-act="rosters:keep"]'); pg.wait_for_timeout(2500)
    gif(record(b, 'fill', fill), 'fill', 3.6, 1100)

    # ---- clip: Ask in your own words ----
    def ask(pg):
        go(pg, 'people/search', 1500); pg.click('#ask-q'); pg.wait_for_timeout(400)
        pg.keyboard.type('Church Partners who serve on the welcome team', delay=45); pg.wait_for_timeout(1800)   # the whole sentence stays on screen
        pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        pg.evaluate("() => { const t = document.querySelector('.adv-table'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }"); pg.wait_for_timeout(2800)
    gif(record(b, 'ask', ask), 'ask', 3.6, 1100)

    # ---- clip: a volunteer accepts from Messages on a phone (sharp still frames, joined) ----
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2); c.add_init_script(HIDE_JS)
    pg = c.new_page(); sign_in(pg, 'p01'); fill_roster(pg); be(pg, 'p09', 'messages')
    fr = os.path.join(TMP, 'acc'); os.makedirs(fr, exist_ok=True); n = [0]
    def snap(k=1):
        for _ in range(k): pg.screenshot(path=os.path.join(fr, '%03d.png' % n[0])); n[0] += 1
    snap(12)
    for _ in range(2):
        btns = pg.query_selector_all('.msg-turns [data-act="rosters:reply"][data-s="accepted"]')
        if not btns: break
        btns[0].scroll_into_view_if_needed(); pg.wait_for_timeout(150); snap(6); btns[0].click(); pg.wait_for_timeout(250); snap(14)
    snap(8); c.close()
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '5', '-i', os.path.join(fr, '%03d.png'), '-vf',
                    'scale=520:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
                    '-loop', '0', os.path.join(OUT, 'accept.gif')], check=True)
    b.close()

# QR codes for the last slide (pip install qrcode)
try:
    import qrcode
    for name, url in [('qr-demo', 'https://pian1966.github.io/church-hub/?demo'), ('qr-site', 'https://pian1966.github.io/church-hub/site/')]:
        q = qrcode.QRCode(border=1, box_size=20); q.add_data(url); q.make(fit=True)
        q.make_image(fill_color='#231E1A', back_color='white').save(os.path.join(OUT, name + '.png'))
except ImportError:
    print('qrcode not installed: the QR codes were kept as they were')
shutil.rmtree(TMP)
print('done:', OUT)
