import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import * as schema from '../drizzle/schema';

function getDbPath(): string {
    // Allow override via environment variable
    if (process.env['TOCKLER_DB_PATH']) {
        return process.env['TOCKLER_DB_PATH'];
    }

    const platform = process.platform;
    let dataDir: string;

    if (platform === 'darwin') {
        dataDir = join(homedir(), 'Library', 'Application Support', 'Tockler');
    } else if (platform === 'win32') {
        dataDir = join(process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming'), 'Tockler');
    } else {
        // Linux
        dataDir = join(homedir(), '.config', 'Tockler');
    }

    const candidates = [
        join(dataDir, 'tracker.db'),
        join(dataDir, 'tockler.db'),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Tockler database not found. Checked: ${candidates.join(', ')}. Set TOCKLER_DB_PATH environment variable to specify the correct path.`,
    );
}

const dbPath = getDbPath();
console.error(`[tockler-mcp] Opening database: ${dbPath}`);

const sqlite = new Database(dbPath, { readonly: true });
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('cache_size = -16000');

export const db = drizzle(sqlite, { schema });
