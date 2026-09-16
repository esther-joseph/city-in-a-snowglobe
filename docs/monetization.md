# Monetisation

How money is meant to reach this project, what is wired up, and what is
deliberately not.

## The shape of it

One component — `src/components/ads/AdSlot.jsx` — is the only thing in the app
that knows an ad exists. Callers name a position:

```jsx
<AdSlot name="drawer-banner" renderMode={renderMode} />
```

What fills it is decided at runtime in `src/services/ads/`:

| Platform | Filled by | Why |
| --- | --- | --- |
| Web (Vercel) | Google AdSense `<ins>` | The site is a website. |
| Play Store build | AdMob banner, through `@capacitor-community/admob` | AdSense's programme policies do not allow it inside a packaged app. Using it there risks the publisher account, not just the placement. |
| Anywhere, ads off | Nothing | Opt-out, AR mode, or a slot with no unit id. |

Swapping the store build onto AdMob is filling in the `native` ids in
`src/services/ads/adConfig.js` and installing the plugin. No component changes,
because no component knows which network answered.

The AdSense loader is injected into `dist/index.html` at build time by the
`adsenseTag` plugin in `vite.config.js`, and only when
`SNOWGLOBE_PLATFORM !== 'native'` — the Android scripts in `package.json` set
that variable, so the tag never ships inside the app binary. Injecting at build
time still leaves the tag statically present in the deployed HTML, which is
what AdSense's site verification reads.

## Where the slots are, and where they are not

- `drawer-banner` — in the weather panel, below the metrics and the timeline.
- `drawer-footer` — the foot of the same panel, below the view-mode controls.

Both are inside a panel the reader opened on purpose, and neither is over the
globe. There is no ad over the AR camera view, and `adsEnabled()` returns
false in AR mode for two reasons: an ad laid over a live camera feed collects
the accidental clicks that get publisher accounts suspended, and it covers the
thing the reader pointed the camera at.

For the same reason there is no "boot straight into AR to maximise
impressions" path. A WebXR session can only start from a user gesture, so a
launch URL cannot enter AR at all — and an impression the reader did not
choose to look at is the kind Google claws back.

## Before this earns anything

1. **AdSense approval.** A one-page WebGL toy with almost no text is the
   profile that gets rejected for "low value content". The fix that also pays
   for itself is real content: per-city pages, a page on how the sky model
   works, one on the weather data. They give the crawler something to read,
   give the reader a reason to arrive from search, and multiply page views —
   which is what display revenue is actually a function of.
2. **`public/ads.txt`** is served and names the publisher. Keep it in step with
   the account.
3. **A consent notice for the EEA and UK.** Serving personalised ads there
   needs a Google-certified CMP. `setAdsEnabled(false)` is the hook a banner
   would call; the banner itself is not built.
4. **A privacy policy that mentions advertising cookies.** `PrivacyPolicy.md`
   predates the ads and needs a paragraph.

## Slot ids

Nothing is hard-coded. Slots with no id render nothing in production (and a
labelled placeholder in development), so the app is safe to deploy before the
ad units exist. See `.env.example`.
