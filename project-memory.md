# Project memory

`index.html`, `rooms.js`, `tour.js`, and `assets/` contain the site. `source/` contains the two user supplied files. The tour plays complete 1080p clips from `assets/scroll/` and `assets/reverse/` on scroll gestures. The page waits for all site media to download before opening.

The bottom booking section embeds the Bmon.AI HighLevel calendar at `https://link.bmon.ai/widget/booking/pJOHnRC4COrbPoHl0yA6` with its `form_embed.js` resize script.

The LeadConnector voice AI widget is loaded after the media gate and rendered inline in `#ai-widget-slot`, below the booking form.
