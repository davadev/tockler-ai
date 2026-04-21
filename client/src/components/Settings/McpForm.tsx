import { FormControl, FormLabel, Spinner, Switch, Text, VStack } from '@chakra-ui/react';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { getMcpIntegrationStatus, setMcpForClaudeCode, setMcpForOpencode } from '../../services/settings.api';
import { CardBox } from '../CardBox';

interface McpStatus {
    opencode: { installed: boolean; enabled: boolean };
    claudeCode: { installed: boolean; enabled: boolean };
}

export const McpForm = () => {
    const [status, setStatus] = useState<McpStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<'opencode' | 'claudeCode' | null>(null);

    useEffect(() => {
        getMcpIntegrationStatus()
            .then(setStatus)
            .finally(() => setLoading(false));
    }, []);

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
            </VStack>
        </CardBox>
    );
};
