import { app, dialog } from 'electron';
import { autoUpdater, UpdateCheckResult, UpdateInfo } from 'electron-updater';
import { config } from '../utils/config';
import { showNotification } from './notification';

import { getCurrentState } from '../background/watchStates/watchAndPropagateState';
import { State } from '../enums/state';
import { logManager } from '../utils/log-manager';
import WindowManager from './window-manager';

const logger = logManager.getLogger('AppUpdater');

// Flag to track if update is in progress to prevent multiple checks/downloads
let updateInProgress = false;

function isAutoUpdatableBuild() {
    const platform = process.platform;

    // Only specific targets are auto-updatable:
    // - macOS: DMG
    // - Linux: AppImage
    // - Windows: NSIS

    // Check if we are running a packaged app (not in development)
    if (!app.isPackaged) {
        return false;
    }

    // For macOS, we can only auto-update DMG builds
    if (platform === 'darwin') {
        return true;
    }

    // For Linux, only AppImage is auto-updatable
    if (platform === 'linux') {
        if (process.env.APPIMAGE) {
            logger.debug('Running as AppImage, auto-updatable.');
            return true;
        }

        logger.debug('Not running as AppImage, not auto-updatable.');
        return false;
    }

    // For Windows, only NSIS installer builds are auto-updatable
    if (platform === 'win32') {
        return !process.env.PORTABLE_EXECUTABLE_DIR;
    }

    return false;
}

// Offline-first: online update checks are opt-in. Default is `false`, meaning
// the app will never contact GitHub / the release server on its own.
function isOnlineUpdateChecksAllowed(): boolean {
    return config.persisted.get('isAutoUpdateEnabled') === true;
}

export default class AppUpdater {
    private static listenersRegistered = false;

    // Lazily register electron-updater event listeners. This is only called
    // from within an explicit user-triggered check, so the listeners cannot
    // cause network activity on startup.
    private static ensureListenersRegistered() {
        if (AppUpdater.listenersRegistered) {
            return;
        }
        AppUpdater.listenersRegistered = true;

        // Never auto-download — the user is prompted on `update-available`.
        autoUpdater.autoDownload = false;
        autoUpdater.logger = logger;

        autoUpdater.allowDowngrade = false;
        autoUpdater.allowPrerelease = false;
        autoUpdater.forceDevUpdateConfig = false;

        autoUpdater.requestHeaders = {
            'Cache-Control': 'no-cache',
        };

        autoUpdater.on('checking-for-update', () => {
            logger.debug('Checking for update...');
        });

        autoUpdater.on('update-available', async (info: UpdateInfo) => {
            logger.debug(`Update ${info.version} available`);

            if (updateInProgress) {
                logger.debug('Update already in progress, not starting new download.');
                return;
            }

            // Ask the user before downloading anything — no silent downloads.
            const { response } = await dialog.showMessageBox({
                type: 'question',
                buttons: ['Download update', 'Cancel'],
                defaultId: 1,
                cancelId: 1,
                title: 'Update available',
                message: `Tockler ${info.version} is available.`,
                detail:
                    `You are running ${app.getVersion()}. ` +
                    `Would you like to download this update from GitHub now? ` +
                    `It will not be installed until you confirm.`,
            });

            if (response !== 0) {
                logger.info('User declined to download update.');
                return;
            }

            updateInProgress = true;
            logger.info('User approved download — starting update download.');

            showNotification({
                body: `Downloading Tockler version ${info.version}`,
                title: 'Update available',
                silent: true,
            });

            autoUpdater.downloadUpdate().catch((err) => {
                updateInProgress = false;
                logger.error('Error downloading update:', err);
            });
        });

        autoUpdater.on('update-not-available', () => {
            logger.debug('No update available');
            updateInProgress = false;
        });

        autoUpdater.on('download-progress', (progressInfo) => {
            logger.debug(`Downloaded: ${Math.round(progressInfo.percent)}% `);
        });

        autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
            logger.debug(`Downloaded Tockler version ${info.version}`);
            updateInProgress = false;

            WindowManager.setTrayIconToUpdate();

            showNotification({
                body: `New version is downloaded and ready to install`,
                title: 'Update available',
                silent: true,
            });
        });

        autoUpdater.on('error', (e) => {
            updateInProgress = false;

            logger.error('AutoUpdater error:', e);
            showNotification({
                title: 'Tockler update error',
                body: e ? (e as Error).stack || '' : 'unknown',
            });
        });
    }

    // Explicit user-triggered update check. No confirmation dialog — use
    // `checkForUpdatesManualWithConfirmation` from user-facing entry points.
    static async checkForUpdatesManual(): Promise<void> {
        logger.info('Manual update check requested.');

        if (!isOnlineUpdateChecksAllowed()) {
            // Offline-first no-op: this is the runtime guard that prevents
            // any accidental network activity when the user has not opted in.
            logger.info(
                'Update check blocked: offline-first mode is active ' +
                    '(`isAutoUpdateEnabled` setting is false). No network request made.',
            );
            showNotification({
                title: 'Online update checks disabled',
                body: 'Enable "Allow online update checks" in Settings → App, then try again.',
                silent: true,
            });
            return;
        }

        if (!isAutoUpdatableBuild()) {
            showNotification({
                body:
                    `Auto updates are not available for this build type. ` +
                    `Please download a signed release manually from ` +
                    `https://github.com/davadev/tockler-ai/releases.`,
                title: 'Updates unavailable',
                silent: true,
            });
            return;
        }

        if (getCurrentState() !== State.Online) {
            logger.info('Update check blocked: system is offline.');
            showNotification({
                title: 'Offline',
                body: 'Cannot check for updates while offline.',
                silent: true,
            });
            return;
        }

        if (updateInProgress) {
            showNotification({
                body: `An update is already in progress.`,
                title: 'Update in progress',
                silent: true,
            });
            return;
        }

        AppUpdater.ensureListenersRegistered();

        showNotification({ body: `Checking for updates...`, silent: true });

        try {
            const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();

            if (result?.updateInfo?.version) {
                const latestVersion = result.updateInfo.version;
                logger.debug(`Update result ${latestVersion}`);
                const currentVersionString = app.getVersion();

                if (currentVersionString === latestVersion) {
                    showNotification({
                        body: `Up to date! You have version ${currentVersionString}`,
                        silent: true,
                    });
                }
                // If there's a newer version, the `update-available` event
                // handler prompts the user before downloading.
            }
        } catch (e) {
            logger.error('Error checking updates', e);
            showNotification({
                title: 'Tockler error',
                body: e ? (e as Error).stack || '' : 'unknown',
            });
        }
    }

    // Shows a native confirmation dialog explaining that this contacts GitHub,
    // then delegates to `checkForUpdatesManual`. Use this from menu items and
    // other user-facing entry points so the warning is always shown.
    static async checkForUpdatesManualWithConfirmation(): Promise<void> {
        if (!isOnlineUpdateChecksAllowed()) {
            logger.info(
                'Manual update check requested while offline-first mode is active — ' +
                    'informing the user instead of proceeding.',
            );
            await dialog.showMessageBox({
                type: 'info',
                title: 'Online update checks disabled',
                message: 'Tockler is running in offline-first mode.',
                detail:
                    'Update checks are disabled by default and no network request ' +
                    'has been made. To check for updates, enable ' +
                    '"Allow online update checks" in Settings → App and try again.',
                buttons: ['OK'],
            });
            return;
        }

        const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Check for updates', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'Check for updates',
            message: 'Check for Tockler updates now?',
            detail:
                'This will contact GitHub to look for a newer Tockler release. ' +
                'No updates will be downloaded or installed without your explicit ' +
                'confirmation.',
        });

        if (response !== 0) {
            logger.info('User cancelled update check confirmation.');
            return;
        }

        await AppUpdater.checkForUpdatesManual();
    }
}
