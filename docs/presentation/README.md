# Church & Trellis – conference presentation

A 17-slide presentation to introduce Church & Trellis at conferences and church gatherings: what a church management system is,
why a church needs one, why we built Church & Trellis, who it is for, what it does (with three short clips), privacy, the
price and how to move across. Speaker notes are on every slide.

| File | What it is |
|---|---|
| `church-and-trellis-presentation.pptx` | The slides (16:9). Open in PowerPoint, Keynote or LibreOffice, or upload to Google Drive and open with Google Slides |
| `build.js` | Builds the .pptx from the pictures in `img/` (Node: `pptxgenjs`, `react-icons`, `react`, `react-dom`, `sharp`) |
| `capture.py` | Takes the screenshots and records the clips from the demo (made-up people, shown as "Grace Community Church") |
| `img/` | The screenshots (`d-…` computer, `m-…` phone), the clips (`fill.gif`, `ask.gif`, `accept.gif`) and the QR codes |

## The slides
1. Church & Trellis – every church, however small, deserves great church software
2. What is a church management system? 3. Why your church needs one
4. Why we built Church & Trellis 5. Who it's for: every church
6. Everything in one place 7. Built in parts – use only what you need 8. The essential parts
9. People 10. Ask in your own words (clip) 11. Rosters that fill the gaps (clip) 12. Volunteers reply from their phone (clip)
13. Members help themselves 14. Safe, private and yours 15. The price of one cup of coffee a month
16. Moving from another system? 17. See your church in Church & Trellis (QR codes to the demo and the website)

Design: Church & Trellis's own colours (orange `E8590C`, dark `231E1A`) and font (Inter, which Google Slides has too). Animation is
kept to the three clips, on the screens that matter most; there are no slide transitions or build animations.

## Keeping it up to date
The `.pptx` here is the master copy. It is rebuilt in the same pull request as any change that alters what the slides say,
and at least whenever the middle version number goes up; the last slide says which version it describes
("Slides for Church & Trellis 0.92.0 · 18 Nov 2026"), so any copy can be checked against **About** in the app. After each merge,
GitHub puts the new slides into the Google Slides copy by itself (`docs/SLIDES-AUTOPUBLISH.md`) – don't edit that copy by
hand, it is replaced; make your own copy (File → Make a copy) to tweak for a particular talk.

## Making it again after Church & Trellis changes
```bash
python3 -m http.server 8765               # in the repository folder (another terminal)
python3 docs/presentation/capture.py      # new screenshots and clips (needs Playwright, Pillow, ffmpeg; qrcode for the QR codes)
cd docs/presentation && node build.js     # writes church-and-trellis-presentation.pptx
```
`build.js` writes the theme's colours too when `PPTX_SKILL` points to a folder with `scripts/apply_theme.js` (Claude's pptx skill);
without it the slides look the same, only PowerPoint's theme palette keeps Office's colours.
Change wording in `build.js` (each slide is one block, with its speaker notes). Keep to what the app really does – no prices
other than the suggested-price wording on the website, and the demo's made-up people only.

## Google Slides
Google Slides plays animated GIFs but drops videos when it converts a .pptx – that is why the clips are GIFs.
To make a Google Slides copy: in Google Drive, **New → File upload** → choose `church-and-trellis-presentation.pptx`, then right-click it →
**Open with → Google Slides** (Drive keeps the original and makes a Google Slides copy). The two computer clips make the file
about 8 MB, too large for Claude's Google Drive connector (about 3 MB), so the upload is done by hand.
