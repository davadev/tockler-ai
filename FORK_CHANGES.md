# tockler-ai

Fork of [Tockler](https://github.com/MayGo/tockler) by MayGo.

## Changes from upstream

### Telemetry removal
- Removed Google Analytics (Measurement Protocol) tracking
- Removed Sentry error reporting
- Deleted: `client/src/useGoogleAnalytics.tsx`, `client/src/useGoogleAnalytics.utils.ts`, `client/src/ga-measurement-protocol.ts`
- Removed `@sentry/electron` dependency

### macOS permission fix
- Replaced `active-win` native binary with AppleScript-based approach to avoid persistent macOS Accessibility permission prompts
- Removed `active-win` dependency

### Offline-first updates
The app is offline-first by default — starting Tockler makes zero update-related
network requests. GitHub / the release server is only contacted after explicit,
per-click user action.

**Default behaviour**
- `AppUpdater.init()` is no longer called on startup. The 8-hour auto-check
  interval is gone entirely.
- The `isAutoUpdateEnabled` setting (surfaced in Settings → App as
  **"Allow online update checks?"**) defaults to **off**. While it is off,
  no update check — manual or otherwise — will make a network request; the
  attempt is logged and becomes a no-op.

**What triggers a network request**
A request to GitHub happens **only** when all of the following are true:
1. The user toggled **Allow online update checks?** on in Settings, AND
2. The user explicitly clicked either the **Check for updates now** button in
   Settings or the **Check for Updates…** menu item, AND
3. The user confirmed the native dialog explaining that this contacts GitHub.

Even after an update is found, nothing is downloaded without a second
confirmation dialog, and nothing is installed without a third confirmation
(the existing tray-click "Install now" prompt).

**Runtime protection**
If the system is offline (`getCurrentState() !== State.Online`) or the setting
is off, `AppUpdater.checkForUpdatesManual` logs a clear message and returns
without touching the network.

**Security tradeoff**
Automatic update checks are disabled by default, so the app will not pull down
security fixes on its own. Users should periodically use **Check for updates
now** and manually install signed releases from the
[releases page](https://github.com/davadev/tockler-ai/releases).

**Packaging config (`electron/electron-builder.yml`)**
`publish: github` is retained. This config is consumed by `electron-builder`
at **release-publishing time** (when `electron-builder` uploads artefacts), and
by `electron-updater` **only when a check is explicitly triggered** via
`autoUpdater.checkForUpdates()`. It does not cause any runtime network activity
on its own. No changes to packaging config were needed to make the app
offline-first — the guarantee lives entirely in the runtime code in
`electron/src/app/app-updater.ts`.

## License

This project is licensed under GPL-2.0, same as the original Tockler project.
Original copyright belongs to MayGo and contributors.
