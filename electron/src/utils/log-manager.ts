import log from 'electron-log/main';
import { config } from './config';

const isProd = process.env['NODE_ENV'] === 'production';

// Initialize electron-log for both main and renderer processes
log.initialize();

// Set reasonable log levels
log.transports.console.level = isProd ? 'warn' : 'debug';
log.transports.file.level = isProd ? 'info' : 'debug';

// Configure file logging based on user preference
let isLoggingEnabled = config.persisted.get('isLoggingEnabled');
if (!isLoggingEnabled) {
    log.transports.file.level = false;
}

const origConsole = log.transports.console.writeFn;
log.transports.console.writeFn = origConsole;

export class LogManager {
    logger: any;

    init(_settings: any) {
        console.log('init LogManager');
        // Re-initialize logger to ensure it's properly set up
        log.initialize();
    }

    getLogger(name: string) {
        return log.scope(name);
    }
}

export const logManager = new LogManager();
