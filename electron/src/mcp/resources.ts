import { eq } from 'drizzle-orm';
import { db } from './db';
import { settings } from '../drizzle/schema';

const DEFAULT_REPORT_PROMPT = `When creating a report from Tockler data, consider both the application name and the window title to understand what the user was actually working on. For example, a browser with title "GitHub - Pull Request #42" should be categorized as development/code review, not just "browser usage". Group related activities into meaningful categories (e.g. Development, Communication, Research, Design) and provide time summaries per category. Highlight the top activities by time spent.`;

export async function getReportInstructions(): Promise<string> {
    try {
        const rows = await db
            .select()
            .from(settings)
            .where(eq(settings.name, 'MCP_SETTINGS'));

        if (rows.length > 0 && rows[0]!.jsonData) {
            const parsed = JSON.parse(rows[0]!.jsonData);
            if (parsed.reportPrompt) {
                return parsed.reportPrompt;
            }
        }
    } catch (e) {
        console.error('[tockler-mcp] Error reading report instructions:', e);
    }

    return DEFAULT_REPORT_PROMPT;
}
