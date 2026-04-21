import fs from 'fs-extra';
import { builtinModules } from 'module';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// Function to copy migrations to dist-electron
function copyMigrations() {
    return {
        name: 'copy-migrations',
        closeBundle() {
            const srcDir = resolve(__dirname, 'src/drizzle/migrations');
            const destDir = resolve(__dirname, 'dist-electron/drizzle/migrations');
            fs.copySync(srcDir, destDir, { overwrite: true });
            console.log('✓ Drizzle migrations copied to dist-electron');
        },
    };
}

export default defineConfig({
    plugins: [
        electron([
            {
                // Main process entry
                entry: 'src/index.ts',
                onstart(options) {
                    options.startup();
                },
                vite: {
                    build: {
                        rollupOptions: {
                            external: [...builtinModules, 'better-sqlite3'],
                        },
                    },
                },
            },
            {
                // Preload scripts
                entry: 'src/preloadStuff.ts',
            },
            {
                // Worker thread
                entry: 'src/drizzle/worker/dbWorker.ts',
                onstart(options) {
                    options.reload();
                },
                vite: {
                    build: {
                        rollupOptions: {
                            external: [...builtinModules, 'better-sqlite3'],
                        },
                    },
                },
            },
            {
                // MCP server entry
                entry: 'src/mcp-server.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: [...builtinModules, 'better-sqlite3'],
                        },
                    },
                },
            },
        ]),
        renderer(),
        copyMigrations(),
    ],
});
