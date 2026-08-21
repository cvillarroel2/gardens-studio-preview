# Gardens Studio — client preview

Standalone static copy of the primary Gardens Studio scroll experience.

## Local test

From this directory:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

## Privacy and deployment defaults

- Search indexing is discouraged by HTML robot metadata, `robots.txt`, and an `X-Robots-Tag` rule in `_headers`.
- Fonts and Three.js are vendored locally; the preview does not depend on Google Fonts or unpkg.
- `_headers` contains security headers understood by Cloudflare Pages and compatible static hosts.
- This is still an ungated static site if deployed publicly. Anyone with the URL can view, forward, and download it.

## Functional caveat

The contact form is a design-only interaction. It validates locally and displays a thank-you message, but it does not transmit or store submissions.
