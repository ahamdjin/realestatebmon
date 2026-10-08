# RealEstateBMON

A guided 1080p real estate tour. Each room transition is drawn frame by frame to a canvas from a 60 fps interpolated clip at 2× speed, taking about three seconds and showing up to 120 distinct frames per second on a 120 Hz display. Selecting any room plays only the transition into that room, with a short fade from the current view. Nearby clips preload while the page remains available.

The booking section embeds the Bmon.AI HighLevel calendar for live appointment selection.

The LeadConnector voice AI widget appears below the demo request after the tour media finishes loading.

## Local preview

Run `python3 -m http.server 8000` in this directory, then open `http://localhost:8000/`.

The original ZIP and 1080p reference video provided for this project are in `source/`.
