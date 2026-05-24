# Norm Network

Norm Network is a real-world proximity networking prototype.

The core idea is simple:

- Turn Norm ON when you want to be discoverable.
- Turn Norm OFF when you want privacy.
- See nearby builders, creators, founders, hardware people, AI people, and local operators.
- Send an intentional connection signal instead of doomscrolling a feed.

## Current MVP

This version includes:

- Mobile-first landing app
- Discoverable ON/OFF switch
- Browser geolocation permission flow
- Editable local profile
- Temporary live nearby-presence API
- Temporary connection-request API
- Demo nearby signals so the product feels alive before real users exist
- Optional vibration/browser notification cues
- No feed, no follower count, no ads

## How to test

Run locally:

```bash
npm install
npm run dev
```

Open the app on two phones or two browsers, use different profile names, allow location, and turn Norm ON on both devices. Live presence is temporary and expires automatically.

## Privacy philosophy

Norm only publishes a profile while the user has intentionally turned the signal ON. When the signal is OFF, the app deletes the current presence from the temporary store. Presence also expires if the browser stops checking in.

## Important technical note

The current backend is intentionally lightweight and temporary. It uses in-memory server data so the MVP can be deployed quickly. For a serious public launch, replace the temporary APIs with a persistent realtime backend such as Supabase, Neon, Firebase, or Vercel KV.

## Product direction

Norm is not trying to become another social media feed. The mission is to become a physical-world signal layer that helps people discover aligned humans nearby.
