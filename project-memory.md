# Project memory

`index.html`, `rooms.js`, `tour.js`, and `assets/` contain the site. `source/` contains the two user supplied files. The tour plays complete 1080p clips from `assets/scroll/` and `assets/reverse/` on scroll gestures. The page waits for all site media to download before opening.

The bottom booking form currently sends a dated email request to `support@bmon.ai`. Replace it with the real calendar embed when a booking URL is supplied.

The LeadConnector voice AI widget is loaded after the media gate and rendered inline in `#ai-widget-slot`, below the booking form.
