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

## License

This project is licensed under GPL-2.0, same as the original Tockler project.
Original copyright belongs to MayGo and contributors.
