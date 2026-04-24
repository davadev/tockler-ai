import { FormControl, FormLabel, Spinner, Switch, Text, Textarea, VStack } from '@chakra-ui/react';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { fetchMcpSettings, getMcpIntegrationStatus, saveMcpSettings, setMcpForClaudeCode, setMcpForOpencode } from '../../services/settings.api';
import { CardBox } from '../CardBox';

interface McpStatus {
    opencode: { installed: boolean; enabled: boolean };
    claudeCode: { installed: boolean; enabled: boolean };
}

const DEFAULT_REPORT_PROMPT = `When creating a report from Tockler data, consider both the application name and the window title to understand what the user was actually working on. For example, a browser with title "GitHub - Pull Request #42" should be categorized as development/code review, not just "browser usage". Group related activities into meaningful categories (e.g. Development, Communication, Research, Design) and provide time summaries per category. Highlight the top activities by time spent.`;

export const McpForm = () => {
    const [status, setStatus] = useState<McpStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<'opencode' | 'claudeCode' | null>(null);
    const [reportPrompt, setReportPrompt] = useState('');
    const promptInitialized = useRef(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const mcpStatus = await getMcpIntegrationStatus();
                setStatus(mcpStatus);
            } catch (e) {
                console.error('Failed to load MCP integration status:', e);
            }

            try {
                const mcpSettings = await fetchMcpSettings();
                if (mcpSettings?.reportPrompt != null) {
                    setReportPrompt(mcpSettings.reportPrompt);
                } else {
                    setReportPrompt(DEFAULT_REPORT_PROMPT);
                }
            } catch (e) {
                console.error('Failed to load MCP settings:', e);
                setReportPrompt(DEFAULT_REPORT_PROMPT);
            }

            promptInitialized.current = true;
            setLoading(false);
        };

        loadData();
    }, []);

    const debouncedSavePrompt = useDebouncedCallback(
        (value: string) => {
            saveMcpSettings({ reportPrompt: value });
        },
        1000,
        { leading: false, trailing: true },
    );

    const onPromptChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const value = event.target.value;
            setReportPrompt(value);
            if (promptInitialized.current) {
                debouncedSavePrompt(value);
            }
        },
        [debouncedSavePrompt],
    );

    const onToggleOpencode = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            setToggling('opencode');
            try {
                const result = await setMcpForOpencode(event.target.checked);
                setStatus(result);
            } finally {
                setToggling(null);
            }
        },
        [],
    );

    const onToggleClaudeCode = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            setToggling('claudeCode');
            try {
                const result = await setMcpForClaudeCode(event.target.checked);
                setStatus(result);
            } finally {
                setToggling(null);
            }
        },
        [],
    );

    if (loading) {
        return (
            <CardBox title="MCP Integrations" divider w="50%">
                <Spinner size="sm" />
            </CardBox>
        );
    }

    return (
        <CardBox title="MCP Integrations" divider w="50%">
            <Text fontSize="sm" color="gray.500" pb={3}>
                Enable Tockler as an MCP server so AI coding agents can query your app usage data.
            </Text>

            <VStack spacing={1} align="stretch">
                <FormControl display="flex" alignItems="center" py={2}>
                    <FormLabel htmlFor="mcp-opencode" mb="0" flex="1">
                        Add to OpenCode
                        {status && !status.opencode.installed && (
                            <Text as="span" fontSize="xs" color="gray.400" ml={2}>
                                (Not installed)
                            </Text>
                        )}
                    </FormLabel>
                    {toggling === 'opencode' ? (
                        <Spinner size="sm" />
                    ) : (
                        <Switch
                            id="mcp-opencode"
                            isChecked={status?.opencode.enabled ?? false}
                            isDisabled={!status?.opencode.installed}
                            onChange={onToggleOpencode}
                            size="lg"
                        />
                    )}
                </FormControl>

                <FormControl display="flex" alignItems="center" py={2}>
                    <FormLabel htmlFor="mcp-claude-code" mb="0" flex="1">
                        Add to Claude Code
                        {status && !status.claudeCode.installed && (
                            <Text as="span" fontSize="xs" color="gray.400" ml={2}>
                                (Not installed)
                            </Text>
                        )}
                    </FormLabel>
                    {toggling === 'claudeCode' ? (
                        <Spinner size="sm" />
                    ) : (
                        <Switch
                            id="mcp-claude-code"
                            isChecked={status?.claudeCode.enabled ?? false}
                            isDisabled={!status?.claudeCode.installed}
                            onChange={onToggleClaudeCode}
                            size="lg"
                        />
                    )}
                </FormControl>

                <FormControl py={4}>
                    <FormLabel htmlFor="mcp-report-prompt">
                        Report Instructions
                    </FormLabel>
                    <Text fontSize="xs" color="gray.500" pb={2}>
                        Custom instructions for how the AI agent should interpret and format reports from your usage data.
                        This is served as an MCP resource that the agent reads before generating reports.
                    </Text>
                    <Textarea
                        id="mcp-report-prompt"
                        value={reportPrompt}
                        onChange={onPromptChange}
                        placeholder={DEFAULT_REPORT_PROMPT}
                        rows={6}
                        fontSize="sm"
                    />
                </FormControl>
            </VStack>
        </CardBox>
    );
};
