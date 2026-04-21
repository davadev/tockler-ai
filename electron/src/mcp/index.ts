#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './tools';

const server = new McpServer({
    name: 'tockler',
    version: '1.0.0',
});

// Register all tools
for (const [name, tool] of Object.entries(tools)) {
    server.tool(name, tool.description, tool.inputSchema.shape, tool.handler as any);
}

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[tockler-mcp] Server started on stdio');
}

main().catch((err) => {
    console.error('[tockler-mcp] Fatal error:', err);
    process.exit(1);
});
