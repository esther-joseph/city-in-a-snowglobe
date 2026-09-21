# Monetisation

How money reaches this project, what is wired up, and what is deliberately not.

## The shape of it

One component, `src/components/ads/AdSlot.jsx`, is the only thing in the app
that knows an ad exists. Callers name a position:

```jsx
<AdSlot name="drawer-banner" renderMode={renderMode} />
```

What fills it is decided at runtime in `src/services/ads/`:

| Platform | Filled by | Why |
| --- | --- | --- |
| Web (Vercel) | Google AdSense `<ins>` | The site is a website. |
| Play Store build | AdMob banner, through `@capacitor-community/admob` | AdSense policies do not allow it inside a packaged app. Using it there risks the whole publisher account, not just the placement. |
| Ads off, or AR, or no unit id | Nothing | |

To move the store build onto AdMob, fill in the `native` ids in
`src/services/ads/adConfig.js` and install the plugin. Nothing else changes,
because no component knows which network answered.

The AdSense loader goes into `dist/index.html` at build time, through the
`adsenseTag` plugin in `vite.config.js`, and only when `SNOWGLOBE_PLATFORM`
is not `native`. The Android scripts in `package.json` set that variable, so
the tag never ships inside the app binary. Building it in still leaves the tag
sitting in the deployed HTML, which is what AdSense site verification looks
for.

## Where the slots are

- `drawer-banner`, in the weather panel, below the metrics and the timeline.
- `drawer-footer`, at the foot of the same panel, below the view mode controls.

Both sit inside a panel you opened on purpose, and neither one covers the
globe.

There is no ad over the AR camera view. `adsEnabled()` returns false in AR
mode for two reasons. An ad on top of a live camera feed collects the
accidental clicks that get publisher accounts suspended, and it covers the
thing you pointed the camera at in the first place.

For the same reason there is no boot straight into AR to catch impressions.
A WebXR session can only start from a user gesture, so a launch URL cannot
enter AR at all, and impressions nobody chose to look at are the kind Google
takes back.

## Before this earns anything

1. **AdSense approval.** A one page WebGL toy with almost no text is the
   profile that gets rejected for low value content. The fix that also pays
   for itself is real content: per city pages, a page on how the sky model
   works, one on the weather data. They give the crawler something to read,
   give people a reason to arrive from search, and multiply page views, which
   is what display revenue actually runs on.
2. **`public/ads.txt`** is served and names the publisher. Keep it in step with
   the account.
3. **A consent notice for the EEA and UK.** Serving personalised ads there
   needs a Google certified CMP. `setAdsEnabled(false)` is the hook a banner
   would call. The banner itself is not built.
4. **A privacy policy that covers advertising cookies.** `PrivacyPolicy.md`
   and `public/privacy.html` both cover it now. Edit them together.

## Slot ids

Nothing is hard coded. A slot with no id renders nothing in production, and a
labelled placeholder in development, so the app is safe to deploy before the
ad units exist. See `.env.example`.
