import { Button, FormControl, FormLabel, Stack, Switch, Text } from '@chakra-ui/react';
import { ChangeEvent, useState } from 'react';

import {
    checkForUpdatesNow,
    getIsAutoUpdateEnabled,
    getIsLoggingEnabled,
    getMacAutoHideMenuBarEnabled,
    getNativeThemeChange,
    getOpenAtLogin,
    getUsePurpleTrayIcon,
    saveIsAutoUpdateEnabled,
    saveIsLoggingEnabled,
    saveMacAutoHideMenuBarEnabled,
    saveNativeThemeChange,
    saveOpenAtLogin,
    saveUsePurpleTrayIcon,
} from '../../services/settings.api';
import '../../types/electron-bridge';
import { CardBox } from '../CardBox';

export const AppForm = () => {
    const isNativeThemeEnabled = getNativeThemeChange();
    const openAtLogin = getOpenAtLogin();
    // Offline-first default: undefined (never set) is treated as false here,
    // matching the main-process gating in app-updater.ts.
    const [allowOnlineUpdateChecks, setAllowOnlineUpdateChecks] = useState(
        getIsAutoUpdateEnabled() === true,
    );
    const isLoggingEnabled = getIsLoggingEnabled();
    const usePurpleTrayIcon = getUsePurpleTrayIcon();
    const macAutoHideMenuBarEnabled = getMacAutoHideMenuBarEnabled();
    const onChangeNativeThemeChange = (event: ChangeEvent<HTMLInputElement>) => {
        saveNativeThemeChange(event.target.checked);
    };
    const onChangeOpenAtLogin = (event: ChangeEvent<HTMLInputElement>) => {
        saveOpenAtLogin(event.target.checked);
    };

    const onChangeAutoUpdate = (event: ChangeEvent<HTMLInputElement>) => {
        const checked = event.target.checked;
        setAllowOnlineUpdateChecks(checked);
        saveIsAutoUpdateEnabled(checked);
    };
    const onClickCheckForUpdates = () => {
        // Main process shows a native confirmation dialog before any network
        // request — this call on its own does not contact GitHub.
        checkForUpdatesNow();
    };
    const onChangeLogging = (event: ChangeEvent<HTMLInputElement>) => {
        saveIsLoggingEnabled(event.target.checked);
    };
    const onChangeUsePurpleTrayIcon = (event: ChangeEvent<HTMLInputElement>) => {
        saveUsePurpleTrayIcon(event.target.checked);
    };
    const onChangeMacAutoHideMenuBarEnabled = (event: ChangeEvent<HTMLInputElement>) => {
        saveMacAutoHideMenuBarEnabled(event.target.checked);
    };

    const appName = import.meta.env.VITE_NAME;
    const platform = window.electronBridge.platform;

    const linuxPath = `~/.config/${appName}/logs/main.log`;
    const macOSPath = `~/Library/Logs/${appName}/main.log`;
    const windowsPath = `%USERPROFILE%\\AppData\\Roaming\${appName}\\logs\\main.log`;

    let logPath = linuxPath;

    const isMacOS = platform === 'darwin';
    if (platform === 'win32') {
        logPath = windowsPath;
    } else if (isMacOS) {
        logPath = macOSPath;
    }

    return (
        <CardBox title="App settings" divider w="50%">
            <FormControl display="flex" alignItems="center" py={2}>
                <FormLabel htmlFor="os-theme" mb="0" flex="1">
                    Use OS theme?
                </FormLabel>
                <Switch
                    id="os-theme"
                    defaultChecked={isNativeThemeEnabled}
                    onChange={onChangeNativeThemeChange}
                    size="lg"
                />
            </FormControl>
            <FormControl display="flex" alignItems="center" py={2}>
                <FormLabel htmlFor="run-login" mb="0" flex="1">
                    Run at login?
                </FormLabel>
                <Switch id="run-login" defaultChecked={openAtLogin} onChange={onChangeOpenAtLogin} size="lg" />
            </FormControl>
            <FormControl display="flex" alignItems="center" py={2}>
                <FormLabel htmlFor="allow-online-update-checks" mb="0" flex="1">
                    Allow online update checks?
                </FormLabel>
                <Switch
                    id="allow-online-update-checks"
                    isChecked={allowOnlineUpdateChecks}
                    onChange={onChangeAutoUpdate}
                    size="lg"
                />
            </FormControl>
            <Text fontSize="xs" color="gray.500" pt={1}>
                Off by default. When disabled, Tockler never contacts the release server. When enabled, you can use
                the button below to manually check for a new version.
            </Text>
            <Stack direction="row" pt={2} pb={2}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClickCheckForUpdates}
                    isDisabled={!allowOnlineUpdateChecks}
                >
                    Check for updates now
                </Button>
            </Stack>
            <Text fontSize="xs" color="gray.500" pb={2}>
                Clicking this contacts GitHub to look for a newer Tockler release. You will be prompted before any
                update is downloaded or installed.
            </Text>

            <FormControl display="flex" alignItems="center" py={2}>
                <FormLabel htmlFor="enable-purple-tray" mb="0" flex="1">
                    Use purple tray icon?
                </FormLabel>
                <Switch
                    id="enable-purple-tray"
                    defaultChecked={usePurpleTrayIcon}
                    onChange={onChangeUsePurpleTrayIcon}
                    size="lg"
                />
            </FormControl>

            <FormControl display="flex" alignItems="center" py={2}>
                <FormLabel htmlFor="enable-logging" mb="0" flex="1">
                    Enable logging? (Applies after restart)
                </FormLabel>
                <Switch id="enable-logging" defaultChecked={isLoggingEnabled} onChange={onChangeLogging} size="lg" />
            </FormControl>
            <Text fontSize="xs" color="gray.500" pt={1}>
                Log path: {logPath}
            </Text>
            {window.electronBridge.platform === 'darwin' && (
                <>
                    <FormControl display="flex" alignItems="center" py={2}>
                        <FormLabel htmlFor="macAutoHideMenuBarEnabled" mb="0" flex="1">
                            Enable tray positioning for auto-hide menu bar
                        </FormLabel>
                        <Switch
                            id="macAutoHideMenuBarEnabled"
                            defaultChecked={macAutoHideMenuBarEnabled}
                            onChange={onChangeMacAutoHideMenuBarEnabled}
                            size="lg"
                        />
                    </FormControl>
                    <Text fontSize="xs" color="gray.500" pt={1}>
                        Enable this if you use "Automatically hide and show the menu bar" in macOS settings
                    </Text>
                </>
            )}
        </CardBox>
    );
};
