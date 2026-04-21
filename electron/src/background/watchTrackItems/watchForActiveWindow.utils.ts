import { execFile } from 'child_process';
import { promisify } from 'util';
import { logManager } from '../../utils/log-manager';

const execFileAsync = promisify(execFile);
const logger = logManager.getLogger('checkActiveWindow');

export const ACTIVE_WINDOW_CHECK_INTERVAL = 3;

export interface NormalizedActiveWindow {
    app: string;
    title: string;
    url?: string;
}

const DEFAULT_TITLE = 'NO_TITLE';
const DEFAULT_APP = 'NATIVE';

// Use AppleScript to get the active window info without triggering Accessibility permission prompts.
const APPLESCRIPT = `
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set appName to name of frontApp
    set windowTitle to ""
    try
        set windowTitle to name of front window of frontApp
    end try
    return appName & "||" & windowTitle
end tell
`;

async function getActiveWindowViaAppleScript(): Promise<NormalizedActiveWindow> {
    try {
        const { stdout } = await execFileAsync('osascript', ['-e', APPLESCRIPT], { timeout: 5000 });
        const output = stdout.trim();
        const separatorIndex = output.indexOf('||');
        if (separatorIndex === -1) {
            return { app: DEFAULT_APP, title: DEFAULT_TITLE };
        }
        const app = output.substring(0, separatorIndex) || DEFAULT_APP;
        const title = output.substring(separatorIndex + 2).replace(/\n$/, '').replace(/^\s/, '') || DEFAULT_TITLE;
        return { app, title };
    } catch (error: any) {
        logger.error('Error getting active window via AppleScript', error);
        return { app: 'PERMISSION_ERROR', title: 'Active Window undefined' };
    }
}

export async function normalizedActiveWindow(): Promise<NormalizedActiveWindow> {
    return getActiveWindowViaAppleScript();
}

export function areEqualActiveWindow(item1: NormalizedActiveWindow, item2: NormalizedActiveWindow) {
    if (item1.title === item2.title && item1.app === item2.app) {
        return true;
    }

    return false;
}
