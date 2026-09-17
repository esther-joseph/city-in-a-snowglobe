# Play Store listing assets

Everything here is generated from the running app by two scripts, so the
artwork is the real snow globe rather than a mockup.

## Regenerating

```bash
npm run dev                # must be running on http://localhost:3000
npm run store:screenshots  # all device sets  (add "phone" / "tablet" to filter)
npm run store:brand        # icon + feature graphic sources (--fresh re-renders)
```

The brand script writes 2x sources into `_work/`; the final files are made with:

```bash
sips -Z 512 _work/icon-source.png --out app-icon-512.png
sips -z 500 1024 _work/feature-2x.png --out feature-graphic-1024x500.png
```

## What to upload where

| Play Console field | File(s) | Size |
| --- | --- | --- |
| App icon | `app-icon-512.png` | 512x512, opaque |
| Feature graphic | `feature-graphic-1024x500.png` | 1024x500 |
| Phone screenshots | `phone/*.png` | 1080x1920 (9:16) |
| 7-inch tablet screenshots | `tablet-7/*.png` | 1920x1080 (16:9) |
| 10-inch tablet screenshots | `tablet-10/*.png` | 2560x1440 (16:9) |
| Chromebook screenshots | `chromebook/*.png` | 2880x1620 (16:9) |
| Android XR screenshots | `xr/*.png` | 2560x1440 (16:9) |

There are seven shots per form factor. Play allows 2-8 per form factor (Chromebook and Android XR require
at least 4); at least 4 at 1080px+ per side keeps the listing eligible for
promotion. Chromebook needs every side between 1,080 and 7,680 px, Android XR
between 720 and 7,680 px - both sets above satisfy the stricter of the two.

## Shot list

| File | State shown |
| --- | --- |
| `01-clear-day` | New York at midday under a clear sky (see note) |
| `02-night` | New York with the time-of-day slider at 22:00 |
| `03-rain` | Mumbai during live rain: clouds and rainfall inside the globe |
| `04-snow` | Reykjavik mid-flurry, straight after a shake (see note) |
| `05-weather-panel` | Weather drawer: conditions, wind, humidity, UV, allergy index |
| `06-forecast` | 12-hour temperature chart and sun position dial |
| `07-weekly` | The day-by-day forecast card |

### Notes

**Two shots set the weather rather than wait for it.** `01-clear-day` and
`04-snow` rewrite the condition code in the API response — to `Clear` and
`Snow` — because each is named for a sky that New York and Reykjavik do not
supply on demand. Everything else uses live OpenWeather data, and in all seven
the rendering is the app's own: only the condition is chosen.

**`04-snow` presses Shake before the shutter.** Falling snow is sparse in a
still frame; the shake fills the globe, and the capture waits for the spin to
finish so the lettering is legible while the snow is still tumbling.

**The icon and the feature graphic also render under a forced clear sky.** At
icon size, cloud cover turns the lit city into a grey smudge; the condition
patch lives in `scripts/lib/simulateCondition.mjs` and both capture scripts use
it.

**Every shot is captured with `?ads=off`.** Store artwork should show the app,
and a development build would otherwise render the ad slots' "no ad unit
configured" placeholder into the listing.
