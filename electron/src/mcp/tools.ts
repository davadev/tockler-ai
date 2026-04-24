import { z } from 'zod';
import { and, asc, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { db } from './db';
import { trackItems } from '../drizzle/schema';
import { TrackItemType } from '../enums/track-item-type';

// Shared schema for time range params
const timeRangeSchema = {
    from: z.string().describe('Start of time range as ISO 8601 datetime (e.g. "2025-01-15T09:00:00"). For relative time queries like "last 3 hours" or "today", call get_current_time first to resolve the correct timestamp.'),
    to: z.string().describe('End of time range as ISO 8601 datetime (e.g. "2025-01-15T23:59:59"). For relative time queries, call get_current_time first to resolve the correct timestamp.'),
};

function formatItem(item: { id: number | null; app: string; taskName: string | null; title: string | null; beginDate: number; endDate: number; color: string | null }) {
    const durationMs = item.endDate - item.beginDate;
    const durationMin = Math.round(durationMs / 60000 * 10) / 10;
    return {
        id: item.id,
        app: item.app,
        title: item.title,
        beginDate: new Date(item.beginDate).toISOString(),
        endDate: new Date(item.endDate).toISOString(),
        durationMinutes: durationMin,
    };
}

export const tools = {
    get_current_time: {
        description: 'Get the current local date and time on the tracked computer. Always call this tool first when the user asks about relative time periods like "last 3 hours", "today", "yesterday", "this week", "since morning", etc. Returns the current ISO 8601 datetime and timezone information needed to construct accurate from/to parameters for other tools.',
        inputSchema: z.object({}),
        handler: async () => {
            const now = new Date();
            const offsetMin = now.getTimezoneOffset();
            const offsetHours = Math.abs(Math.floor(offsetMin / 60));
            const offsetMins = Math.abs(offsetMin % 60);
            const sign = offsetMin <= 0 ? '+' : '-';
            const timezone = `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        currentTime: now.toISOString(),
                        localTime: now.toLocaleString(),
                        timezone,
                        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                    }, null, 2),
                }],
            };
        },
    },

    query_app_usage: {
        description: 'Query application usage in a specific time range. Returns which apps were used, their window titles, and durations. Use this for questions like "what was I working on", "which apps did I use", "what did I do". For relative time queries, call get_current_time first. When generating a report, read the tockler://report-instructions resource for the user\'s preferred formatting.',
        inputSchema: z.object({
            ...timeRangeSchema,
            searchStr: z.string().optional().describe('Optional filter: search in app name or window title'),
        }),
        handler: async (params: { from: string; to: string; searchStr?: string }) => {
            const fromMs = new Date(params.from).getTime();
            const toMs = new Date(params.to).getTime();

            const conditions = [
                eq(trackItems.taskName, TrackItemType.AppTrackItem),
                gte(trackItems.endDate, fromMs),
                lte(trackItems.endDate, toMs),
            ];

            if (params.searchStr) {
                conditions.push(like(trackItems.title, `%${params.searchStr}%`));
            }

            const items = await db
                .select()
                .from(trackItems)
                .where(and(...conditions))
                .orderBy(asc(trackItems.beginDate));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        count: items.length,
                        items: items.map(formatItem),
                    }, null, 2),
                }],
            };
        },
    },

    query_status_log: {
        description: 'Query computer status (Online/Idle/Offline) in a specific time range. Shows when the computer was active, idle, or offline. Use this for questions like "was I active", "how long was I idle", "when was I away". For relative time queries, call get_current_time first.',
        inputSchema: z.object(timeRangeSchema),
        handler: async (params: { from: string; to: string }) => {
            const fromMs = new Date(params.from).getTime();
            const toMs = new Date(params.to).getTime();

            const items = await db
                .select()
                .from(trackItems)
                .where(and(
                    eq(trackItems.taskName, TrackItemType.StatusTrackItem),
                    gte(trackItems.endDate, fromMs),
                    lte(trackItems.endDate, toMs),
                ))
                .orderBy(asc(trackItems.beginDate));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        count: items.length,
                        items: items.map(item => ({
                            status: item.app,
                            beginDate: new Date(item.beginDate).toISOString(),
                            endDate: new Date(item.endDate).toISOString(),
                            durationMinutes: Math.round((item.endDate - item.beginDate) / 60000 * 10) / 10,
                        })),
                    }, null, 2),
                }],
            };
        },
    },

    get_usage_summary: {
        description: 'Get aggregated app usage summary for a time range. Returns total time per application, sorted by most used. Prefer this over query_app_usage for summary/aggregate questions like "how did I spend my time", "what took most of my time". For relative time queries, call get_current_time first. When generating a report, read the tockler://report-instructions resource for the user\'s preferred formatting.',
        inputSchema: z.object(timeRangeSchema),
        handler: async (params: { from: string; to: string }) => {
            const fromMs = new Date(params.from).getTime();
            const toMs = new Date(params.to).getTime();

            const items = await db
                .select({
                    app: trackItems.app,
                    totalDurationMs: sql<number>`SUM(${trackItems.endDate} - ${trackItems.beginDate})`,
                    count: sql<number>`COUNT(*)`,
                })
                .from(trackItems)
                .where(and(
                    eq(trackItems.taskName, TrackItemType.AppTrackItem),
                    gte(trackItems.endDate, fromMs),
                    lte(trackItems.endDate, toMs),
                ))
                .groupBy(trackItems.app)
                .orderBy(desc(sql`SUM(${trackItems.endDate} - ${trackItems.beginDate})`));

            const totalMs = items.reduce((sum, i) => sum + Number(i.totalDurationMs), 0);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        from: params.from,
                        to: params.to,
                        totalMinutes: Math.round(totalMs / 60000 * 10) / 10,
                        apps: items.map(item => ({
                            app: item.app,
                            totalMinutes: Math.round(Number(item.totalDurationMs) / 60000 * 10) / 10,
                            sessions: Number(item.count),
                            percentOfTotal: totalMs > 0 ? Math.round(Number(item.totalDurationMs) / totalMs * 1000) / 10 : 0,
                        })),
                    }, null, 2),
                }],
            };
        },
    },

    get_log_items: {
        description: 'Query manual log entries (user-created time entries) in a specific time range. These are entries the user manually added, not automatically tracked app usage. For relative time queries, call get_current_time first.',
        inputSchema: z.object(timeRangeSchema),
        handler: async (params: { from: string; to: string }) => {
            const fromMs = new Date(params.from).getTime();
            const toMs = new Date(params.to).getTime();

            const items = await db
                .select()
                .from(trackItems)
                .where(and(
                    eq(trackItems.taskName, TrackItemType.LogTrackItem),
                    gte(trackItems.endDate, fromMs),
                    lte(trackItems.endDate, toMs),
                ))
                .orderBy(asc(trackItems.beginDate));

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        count: items.length,
                        items: items.map(formatItem),
                    }, null, 2),
                }],
            };
        },
    },
};
