import { exec, execFile } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, extname, join, resolve } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Resolve absolute path to the MCP server entry point
const MCP_TS_SCRIPT_PATH = resolve(__dirname, '..', 'src', 'mcp', 'index.ts');
const MCP_JS_SCRIPT_PATH = resolve(__dirname, '..', 'dist-electron', 'mcp-server.js');

/**
 * Augmented PATH that includes common user binary directories.
 * Electron's child processes don't inherit the user's full login shell PATH,
 * so we manually add directories where tools like opencode, claude, npx typically live.
 */
function getAugmentedPath(): string {
    const home = homedir();
    const extraDirs = [
        join(home, '.opencode', 'bin'),
        join(home, '.npm-global', 'bin'),
        join(home, '.nvm', 'versions', 'node'), // we'll also try login shell
        '/usr/local/bin',
        '/opt/homebrew/bin',
        join(home, '.local', 'bin'),
        join(home, 'bin'),
    ];
    const currentPath = process.env.PATH || '';
    return [...extraDirs, currentPath].join(':');
}

async function which(command: string): Promise<string | null> {
    // First try: use a login shell to get the user's full PATH
    if (process.platform !== 'win32') {
        try {
            const { stdout } = await execAsync(`/bin/bash -lc 'which ${command}'`, {
                timeout: 5000,
            });
            const result = stdout.trim().split('\n')[0];
            if (result) return result;
        } catch { /* fall through */ }
    }

    // Second try: use augmented PATH
    try {
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execFileAsync(cmd, [command], {
            env: { ...process.env, PATH: getAugmentedPath() },
        });
        return stdout.trim().split('\n')[0] || null;
    } catch {
        return null;
    }
}

export async function checkToolInstalled(tool: 'opencode' | 'claude'): Promise<boolean> {
    const path = await which(tool);
    return path !== null;
}

function getMcpScriptPath(): string {
    // Prefer compiled JS (works in packaged apps), fallback to TS in development.
    const candidates = [
        // Packaged app locations
        resolve(process.resourcesPath, 'app', 'dist-electron', 'mcp-server.js'),
        resolve(process.resourcesPath, 'dist-electron', 'mcp-server.js'),
        // Development/build locations
        MCP_JS_SCRIPT_PATH,
        resolve(__dirname, 'mcp-server.js'),
        resolve(__dirname, '..', 'mcp-server.js'),
        resolve(__dirname, '..', 'dist-electron', 'mcp-server.js'),
        // TS fallback for development
        MCP_TS_SCRIPT_PATH,
        resolve(__dirname, 'src', 'mcp', 'index.ts'),
        resolve(__dirname, '..', 'src', 'mcp', 'index.ts'),
        resolve(__dirname, '..', '..', 'src', 'mcp', 'index.ts'),
        resolve(__dirname, '..', '..', 'electron', 'src', 'mcp', 'index.ts'),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    // Fallback: use the path relative to the project
    // Find the electron directory by looking for package.json
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        const pkgPath = join(dir, 'package.json');
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                if (pkg.name === 'tockler-ai') {
                    return join(dir, 'src', 'mcp', 'index.ts');
                }
            } catch { /* ignore */ }
        }
        dir = dirname(dir);
    }

    return MCP_TS_SCRIPT_PATH;
}

interface McpCommandConfig {
    command: string[];
    environment?: Record<string, string>;
    env?: Record<string, string>;
}

async function getMcpCommandConfig(): Promise<McpCommandConfig> {
    const scriptPath = getMcpScriptPath();

    if (extname(scriptPath) === '.js') {
        // Use Electron runtime for ABI compatibility with better-sqlite3.
        return {
            command: [process.execPath, scriptPath],
            environment: { ELECTRON_RUN_AS_NODE: '1' },
            env: { ELECTRON_RUN_AS_NODE: '1' },
        };
    }

    const npxPath = await which('npx') || 'npx';
    return {
        command: [npxPath, 'tsx', scriptPath],
    };
}

// --- OpenCode ---

function getOpencodeConfigPath(): string {
    return join(homedir(), '.config', 'opencode', 'opencode.json');
}

function readJsonFile(path: string): Record<string, any> {
    try {
        if (existsSync(path)) {
            const content = readFileSync(path, 'utf-8');
            return JSON.parse(content);
        }
    } catch { /* ignore parse errors */ }
    return {};
}

function writeJsonFile(path: string, data: Record<string, any>): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

export async function isOpencodeMcpEnabled(): Promise<boolean> {
    const config = readJsonFile(getOpencodeConfigPath());
    return !!(config.mcp && config.mcp.tockler);
}

export async function setOpencodeMcp(enabled: boolean): Promise<void> {
    const configPath = getOpencodeConfigPath();
    const config = readJsonFile(configPath);

    if (enabled) {
        if (!config.mcp) {
            config.mcp = {};
        }

        const mcpCommand = await getMcpCommandConfig();

        config.mcp.tockler = {
            type: 'local',
            command: mcpCommand.command,
            enabled: true,
            ...(mcpCommand.environment ? { environment: mcpCommand.environment } : {}),
        };
    } else {
        if (config.mcp && config.mcp.tockler) {
            delete config.mcp.tockler;
        }
    }

    writeJsonFile(configPath, config);
}

// --- Claude Code ---

export async function isClaudeCodeMcpEnabled(): Promise<boolean> {
    const claudePath = await which('claude');
    if (!claudePath) return false;

    try {
        const { stdout } = await execFileAsync(claudePath, ['mcp', 'list'], {
            timeout: 10000,
            env: { ...process.env, NO_COLOR: '1' },
        });
        return stdout.includes('tockler');
    } catch {
        return false;
    }
}

export async function setClaudeCodeMcp(enabled: boolean): Promise<void> {
    const claudePath = await which('claude');
    if (!claudePath) {
        throw new Error('Claude Code CLI is not installed');
    }

    if (enabled) {
        const mcpCommand = await getMcpCommandConfig();

        const serverConfig: Record<string, unknown> = {
            type: 'stdio',
            command: mcpCommand.command[0],
            args: mcpCommand.command.slice(1),
        };

        if (mcpCommand.env) {
            serverConfig.env = mcpCommand.env;
        }

        await execFileAsync(claudePath, ['mcp', 'add-json', '-s', 'user', 'tockler', JSON.stringify(serverConfig)], {
            timeout: 15000,
        });
    } else {
        await execFileAsync(claudePath, ['mcp', 'remove', '-s', 'user', 'tockler'], {
            timeout: 15000,
        });
    }
}

// --- Combined status ---

export interface McpIntegrationStatus {
    opencode: { installed: boolean; enabled: boolean };
    claudeCode: { installed: boolean; enabled: boolean };
}

export async function getMcpIntegrationStatus(): Promise<McpIntegrationStatus> {
    const [opencodeInstalled, claudeInstalled] = await Promise.all([
        checkToolInstalled('opencode'),
        checkToolInstalled('claude'),
    ]);

    const [opencodeEnabled, claudeEnabled] = await Promise.all([
        opencodeInstalled ? isOpencodeMcpEnabled() : Promise.resolve(false),
        claudeInstalled ? isClaudeCodeMcpEnabled() : Promise.resolve(false),
    ]);

    return {
        opencode: { installed: opencodeInstalled, enabled: opencodeEnabled },
        claudeCode: { installed: claudeInstalled, enabled: claudeEnabled },
    };
}
