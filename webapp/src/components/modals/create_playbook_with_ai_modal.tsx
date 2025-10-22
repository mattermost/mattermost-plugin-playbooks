// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ComponentProps,
    useEffect,
    useRef,
    useState,
} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useHistory} from 'react-router-dom';

import {Checklist, DraftPlaybookWithChecklist, setPlaybookDefaults} from 'src/types/playbook';
import GenericModal from 'src/components/widgets/generic_modal';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {sendAIPlaybookMessage, AIPost, savePlaybook, clientFetchPlaybook} from 'src/client';
import {navigateToUrl} from 'src/browser_routing';

const ID = 'playbooks_create_with_ai';

export const makePlaybookCreateWithAIModal = (props: PlaybookCreateWithAIModalProps) => ({
    modalId: ID,
    dialogType: PlaybookCreateWithAIModal,
    dialogProps: props,
});

export type PlaybookCreateWithAIModalProps = {
    initialPlaybookId?: string;
} & Partial<ComponentProps<typeof GenericModal>>;

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// Sample checklist data (will be replaced by AI-generated checklists in the future)
const SAMPLE_CHECKLISTS: Checklist[] = [
    {
        title: 'Incident Detection',
        items: [
            {
                title: 'Identify and confirm the incident',
                description: 'Verify that an incident has occurred and assess initial impact',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
            {
                title: 'Assess severity and priority',
                description: 'Determine incident severity level and prioritize response',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
            {
                title: 'Create incident channel',
                description: 'Set up dedicated communication channel for incident response',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
        ],
    },
    {
        title: 'Communication',
        items: [
            {
                title: 'Notify stakeholders',
                description: 'Alert relevant stakeholders about the incident',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
            {
                title: 'Update status page',
                description: 'Post incident status to public status page',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
        ],
    },
    {
        title: 'Resolution',
        items: [
            {
                title: 'Implement fix or workaround',
                description: 'Apply solution to resolve the incident',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
            {
                title: 'Verify resolution',
                description: 'Confirm that the incident has been fully resolved',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
            {
                title: 'Schedule post-mortem',
                description: 'Set up post-incident review meeting',
                state: 'open',
                state_modified: 0,
                assignee_id: '',
                assignee_modified: 0,
                command: '',
                command_last_run: 0,
                due_date: 0,
                task_actions: [],
                condition_id: '',
                condition_action: '',
                condition_reason: '',
            },
        ],
    },
];

const PlaybookCreateWithAIModal = ({initialPlaybookId, ...modalProps}: PlaybookCreateWithAIModalProps) => {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [playbookName, setPlaybookName] = useState('');
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [checklistsCollapseState, setChecklistsCollapseState] = useState<Record<number, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mockChannelId] = useState('mock_ai_channel_' + Date.now());
    const [existingPlaybook, setExistingPlaybook] = useState<DraftPlaybookWithChecklist | null>(null);

    // Load existing playbook if an ID is provided
    useEffect(() => {
        if (initialPlaybookId) {
            clientFetchPlaybook(initialPlaybookId).then((playbook) => {
                if (playbook) {
                    setExistingPlaybook(playbook);
                    setPlaybookName(playbook.title);
                    setChecklists(playbook.checklists);

                    // Add a system message to inform the AI about the existing playbook
                    const playbookContext = {
                        title: playbook.title,
                        description: playbook.description,
                        checklists: playbook.checklists,
                    };

                    const contextMessage: Message = {
                        role: 'assistant',
                        content: `I can see you've created a playbook${playbook.title ? ` called "${playbook.title}"` : ''}${playbook.checklists.length > 0 ? ` with ${playbook.checklists.length} existing checklist(s)` : ''}. I'm ready to help you enhance it! You can ask me to:\n\n- Add new tasks or checklists\n- Modify existing tasks\n- Reorganize the structure\n- Suggest improvements\n\nWhat would you like to do?`,
                        timestamp: Date.now(),
                    };
                    setMessages([contextMessage]);
                }
            }).catch((err) => {
                console.error('Failed to load playbook:', err);
                setError('Failed to load playbook');
            });
        }
    }, [initialPlaybookId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) {
            return 'Just now';
        } else if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        }
        return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    const renderMessageContent = (content: string) => {
        // Remove the playbook schema JSON from the display
        // The schema will be shown in the right panel instead
        let displayContent = content;
        const markerIndex = content.indexOf('<!-- PLAYBOOK_SCHEMA -->');
        if (markerIndex !== -1) {
            // Find the end of the JSON codeblock
            const afterMarker = content.substring(markerIndex);
            const jsonBlockStart = afterMarker.indexOf('```json');
            if (jsonBlockStart !== -1) {
                const jsonEnd = afterMarker.indexOf('```', jsonBlockStart + 7);
                if (jsonEnd !== -1) {
                    // Remove everything from the marker to the end of the codeblock
                    const schemaEnd = markerIndex + jsonEnd + 3;
                    displayContent = content.substring(0, markerIndex) + content.substring(schemaEnd);
                }
            }
        }

        // Use Mattermost's built-in markdown rendering
        if (formatText && messageHtmlToComponent) {
            const formattedText = formatText(displayContent.trim(), {
                singleline: false,
                mentionHighlight: false,
            });
            return messageHtmlToComponent(formattedText);
        }
        // Fallback to plain text if Mattermost utils aren't available
        return displayContent.trim();
    };

    const parsePlaybookSchema = (message: string): Checklist[] | null => {
        // Look for the special marker that indicates a playbook schema
        const markerIndex = message.indexOf('<!-- PLAYBOOK_SCHEMA -->');
        if (markerIndex === -1) {
            return null;
        }

        // Find the JSON code block after the marker
        const afterMarker = message.substring(markerIndex);
        const jsonBlockStart = afterMarker.indexOf('```json');
        if (jsonBlockStart === -1) {
            return null;
        }

        const jsonStart = afterMarker.indexOf('\n', jsonBlockStart) + 1;
        const jsonEnd = afterMarker.indexOf('```', jsonStart);
        if (jsonEnd === -1) {
            return null;
        }

        const jsonString = afterMarker.substring(jsonStart, jsonEnd).trim();

        try {
            const parsed = JSON.parse(jsonString);

            // Validate structure
            if (!parsed.checklists || !Array.isArray(parsed.checklists)) {
                console.error('Invalid playbook schema: missing or invalid checklists array');
                return null;
            }

            // Return the checklists directly - they should have all required fields
            return parsed.checklists as Checklist[];
        } catch (err) {
            console.error('Failed to parse playbook schema JSON:', err);
            return null;
        }
    };

    const handleSendMessage = async (messageContent?: string) => {
        const content = messageContent || inputValue;
        if (!content.trim() || isLoading) {
            return;
        }

        // Clear any previous errors
        setError(null);

        // Add user message
        const userMessage: Message = {
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Build conversation history for AI request
            let conversationHistory: AIPost[] = [...messages, userMessage].map((msg) => ({
                role: msg.role,
                message: msg.content,
            }));

            // If this is the first user message and we have an existing playbook,
            // prepend a system message with the playbook context
            if (existingPlaybook && messages.length <= 1) {
                const playbookContextJson = JSON.stringify({
                    title: existingPlaybook.title,
                    description: existingPlaybook.description,
                    checklists: existingPlaybook.checklists,
                }, null, 2);

                const systemContext: AIPost = {
                    role: 'user',
                    message: `Here is the current playbook structure that needs to be enhanced:\n\n\`\`\`json\n${playbookContextJson}\n\`\`\`\n\nNow, the user's request: ${content}`,
                };

                // Replace the first user message with the enhanced version
                conversationHistory = conversationHistory.map((msg, idx) => {
                    if (idx === conversationHistory.length - 1) {
                        return systemContext;
                    }
                    return msg;
                });
            }

            // Send request to AI service
            const aiResponse = await sendAIPlaybookMessage(conversationHistory);

            // Add AI response to messages
            const aiMessage: Message = {
                role: 'assistant',
                content: aiResponse,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMessage]);

            // Try to parse playbook schema from the response
            const parsedChecklists = parsePlaybookSchema(aiResponse);
            if (parsedChecklists) {
                // Update the checklists with the parsed schema
                setChecklists(parsedChecklists);
            }
            // If no schema found, that's fine - it's just a conversational message

        } catch (err) {
            // Handle error
            const errorMessage = err instanceof Error ? err.message : 'Failed to get response from AI';
            setError(errorMessage);

            // Add error message to chat
            const errorChatMessage: Message = {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorChatMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const onChecklistCollapsedStateChange = (checklistIndex: number, state: boolean) => {
        setChecklistsCollapseState((prev) => ({...prev, [checklistIndex]: state}));
    };

    const onEveryChecklistCollapsedStateChange = (state: Record<number, boolean>) => {
        setChecklistsCollapseState(state);
    };

    const handleCreatePlaybook = async () => {
        if (checklists.length === 0) {
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            let draftPlaybook: DraftPlaybookWithChecklist;

            if (existingPlaybook) {
                // Update the existing playbook with AI-generated checklists
                draftPlaybook = {
                    ...existingPlaybook,
                    title: playbookName,
                    checklists,
                    num_stages: checklists.length,
                    num_steps: checklists.reduce((sum, cl) => sum + cl.items.length, 0),
                };
            } else {
                // Create a draft playbook with the AI-generated checklists
                draftPlaybook = {
                    title: playbookName,
                    description: 'Playbook created with AI assistance',
                    team_id: currentTeamId,
                    public: true,
                    create_public_playbook_run: false,
                    delete_at: 0,
                    num_stages: checklists.length,
                    num_steps: checklists.reduce((sum, cl) => sum + cl.items.length, 0),
                    num_runs: 0,
                    num_actions: 0,
                    last_run_at: 0,
                    checklists,
                    members: [],
                    default_playbook_member_role: 'member',
                    reminder_message_template: '',
                    reminder_timer_default_seconds: 7 * 24 * 60 * 60,
                    status_update_enabled: true,
                    invited_user_ids: [],
                    invited_group_ids: [],
                    invite_users_enabled: false,
                    default_owner_id: '',
                    default_owner_enabled: false,
                    broadcast_channel_ids: [],
                    broadcast_enabled: false,
                    webhook_on_creation_urls: [],
                    webhook_on_creation_enabled: false,
                    webhook_on_status_update_urls: [],
                    webhook_on_status_update_enabled: false,
                    message_on_join: '',
                    message_on_join_enabled: false,
                    retrospective_reminder_interval_seconds: 0,
                    retrospective_template: '',
                    retrospective_enabled: false,
                    signal_any_keywords_enabled: false,
                    signal_any_keywords: [],
                    categorize_channel_enabled: false,
                    category_name: '',
                    run_summary_template_enabled: false,
                    run_summary_template: '',
                    channel_name_template: '',
                    channel_id: '',
                    channel_mode: 'create_new_channel',
                    create_channel_member_on_new_participant: true,
                    remove_channel_member_on_removed_participant: true,
                    metrics: [],
                    is_favorite: false,
                    active_runs: 0,
                    propertyFields: [],
                };
            }

            // Set defaults for any missing fields
            const playbookWithDefaults = setPlaybookDefaults(draftPlaybook);

            // Save the playbook
            const result = await savePlaybook(playbookWithDefaults);

            // Close the modal and navigate to the newly created playbook
            const playbookId = result.id || existingPlaybook?.id;
            if (playbookId) {
                modalProps.onHide?.();
                navigateToUrl(`/playbooks/playbooks/${playbookId}`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create playbook';
            setError(errorMessage);
            setIsCreating(false);
        }
    };

    const modalHeaderText = existingPlaybook
        ? formatMessage({defaultMessage: 'Enhance playbook with AI'})
        : formatMessage({defaultMessage: 'Create playbook with AI'});

    const confirmButtonText = isCreating
        ? formatMessage({defaultMessage: 'Saving...'})
        : formatMessage({defaultMessage: 'Save playbook'});

    return (
        <StyledGenericModal
            id={ID}
            modalHeaderText={modalHeaderText}
            {...modalProps}
            confirmButtonText={confirmButtonText}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={checklists.length === 0 || isCreating}
            handleConfirm={handleCreatePlaybook}
            showCancel={true}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
        >
            <SplitView>
                <LeftPanel>
                    <ChatHeader>
                        {formatMessage({defaultMessage: 'Chat with AI'})}
                    </ChatHeader>
                    <MessagesContainer>
                        {messages.length === 0 && (
                            <EmptyState>
                                {formatMessage({defaultMessage: 'Start a conversation to generate playbook tasks'})}
                            </EmptyState>
                        )}
                        {messages.map((message, index) => (
                            <PostContainer key={index}>
                                <PostHeader>
                                    <Avatar $isBot={message.role === 'assistant'}>
                                        {message.role === 'assistant' ? (
                                            <i className='icon icon-robot-outline'/>
                                        ) : (
                                            <i className='icon icon-account-outline'/>
                                        )}
                                    </Avatar>
                                    <PostMeta>
                                        <Username>
                                            {message.role === 'assistant' ? 'AI Assistant' : 'You'}
                                        </Username>
                                        <PostTime>
                                            {formatTime(message.timestamp)}
                                        </PostTime>
                                    </PostMeta>
                                </PostHeader>
                                <PostBody>
                                    {renderMessageContent(message.content)}
                                </PostBody>
                            </PostContainer>
                        ))}
                        {isLoading && (
                            <PostContainer>
                                <PostHeader>
                                    <Avatar $isBot={true}>
                                        <i className='icon icon-robot-outline'/>
                                    </Avatar>
                                    <PostMeta>
                                        <Username>AI Assistant</Username>
                                        <PostTime>Just now</PostTime>
                                    </PostMeta>
                                </PostHeader>
                                <PostBody>
                                    <LoadingIndicator>Thinking...</LoadingIndicator>
                                </PostBody>
                            </PostContainer>
                        )}
                        <div ref={messagesEndRef}/>
                    </MessagesContainer>
                    <InputContainer>
                        <TextInput
                            placeholder={formatMessage({defaultMessage: 'Describe the playbook you want to create...'})}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            rows={3}
                        />
                        <SendButton
                            onClick={() => handleSendMessage()}
                            disabled={!inputValue.trim() || isLoading}
                        >
                            {isLoading ? (
                                <i className='icon icon-loading icon-spin'/>
                            ) : (
                                <i className='icon icon-send'/>
                            )}
                        </SendButton>
                    </InputContainer>
                </LeftPanel>
                <RightPanel>
                    <TaskListHeader>
                        {playbookName || formatMessage({defaultMessage: 'Playbook Tasks'})}
                    </TaskListHeader>
                    <TaskListContainer>
                        {checklists.length === 0 ? (
                            <EmptyTaskState>
                                {formatMessage({defaultMessage: 'Tasks will appear here based on your conversation with AI'})}
                            </EmptyTaskState>
                        ) : (
                            <>
                                {checklists.map((checklist, checklistIndex) => (
                                    <ChecklistPreview key={checklistIndex}>
                                        <ChecklistHeader
                                            onClick={() => onChecklistCollapsedStateChange(
                                                checklistIndex,
                                                !checklistsCollapseState[checklistIndex]
                                            )}
                                        >
                                            <ChecklistTitle>
                                                <CollapseIcon $collapsed={checklistsCollapseState[checklistIndex]}>
                                                    <i className='icon icon-chevron-right'/>
                                                </CollapseIcon>
                                                {checklist.title}
                                            </ChecklistTitle>
                                            <ChecklistCount>
                                                {checklist.items.length} {checklist.items.length === 1 ? 'task' : 'tasks'}
                                            </ChecklistCount>
                                        </ChecklistHeader>
                                        {!checklistsCollapseState[checklistIndex] && (
                                            <ChecklistItems>
                                                {checklist.items.map((item, itemIndex) => (
                                                    <TaskItem key={itemIndex}>
                                                        <TaskCheckbox>
                                                            <i className='icon icon-check-circle-outline'/>
                                                        </TaskCheckbox>
                                                        <TaskContent>
                                                            <TaskTitle>{item.title}</TaskTitle>
                                                            {item.description && (
                                                                <TaskDescription>{item.description}</TaskDescription>
                                                            )}
                                                        </TaskContent>
                                                    </TaskItem>
                                                ))}
                                            </ChecklistItems>
                                        )}
                                    </ChecklistPreview>
                                ))}
                            </>
                        )}
                    </TaskListContainer>
                </RightPanel>
            </SplitView>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    width: 1200px;
    max-width: 95vw;

    .modal-body {
        padding: 0;
        max-height: 70vh;
        overflow: hidden;
    }
`;

const SplitView = styled.div`
    display: flex;
    width: 100%;
    height: 600px;
    max-height: 70vh;
`;

const LeftPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    min-height: 0; /* Important: allows flex children to shrink below content size */
`;

const RightPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--center-channel-bg);
    min-height: 0; /* Important: allows flex children to shrink below content size */
`;

const ChatHeader = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    flex-shrink: 0; /* Prevent header from shrinking */
`;

const TaskListHeader = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    flex-shrink: 0; /* Prevent header from shrinking */
`;

const MessagesContainer = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0; /* Important: allows scrolling to work properly */
`;

const TaskListContainer = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    min-height: 0; /* Important: allows scrolling to work properly */
`;

const EmptyState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    text-align: center;
    padding: 20px;
`;

const EmptyTaskState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    text-align: center;
    padding: 20px;
`;

const PostContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 12px 0;

    &:last-child {
        border-bottom: none;
    }
`;

const PostHeader = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 4px;
`;

const Avatar = styled.div<{$isBot: boolean}>`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${({$isBot}) => ($isBot ? 'rgba(var(--button-bg-rgb), 0.12)' : 'rgba(var(--center-channel-color-rgb), 0.12)')};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    flex-shrink: 0;

    i {
        font-size: 18px;
        color: ${({$isBot}) => ($isBot ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    }
`;

const PostMeta = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
`;

const Username = styled.div`
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
`;

const PostTime = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const PostBody = styled.div`
    margin-left: 40px;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    word-wrap: break-word;
    max-width: 100%;
    overflow: hidden;

    /* Mattermost's markdown rendering classes */
    pre {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        padding: 12px;
        overflow-x: auto;
        max-width: 100%;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 12px;
        line-height: 18px;
    }

    code {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 12px;
        word-break: break-word;
    }

    pre code {
        background: none;
        padding: 0;
        word-break: normal;
    }
`;

const InputContainer = styled.div`
    display: flex;
    align-items: flex-end;
    padding: 16px;
    gap: 8px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    flex-shrink: 0; /* Prevent input from being pushed out of view */
`;

const TextInput = styled.textarea`
    flex: 1;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    resize: vertical;
    min-height: 60px;
    max-height: 150px;
    font-family: inherit;

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.12);
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const SendButton = styled.button`
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    background: var(--button-bg);
    color: var(--button-color);
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    min-width: 40px;

    &:hover:not(:disabled) {
        background: var(--button-bg-hover);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    i {
        font-size: 18px;
    }
`;

// Checklist preview components
const ChecklistPreview = styled.div`
    margin-bottom: 16px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ChecklistHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    cursor: pointer;
    user-select: none;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const ChecklistTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
`;

const CollapseIcon = styled.div<{$collapsed: boolean}>`
    display: flex;
    align-items: center;
    transition: transform 0.2s ease;
    transform: ${({$collapsed}) => ($collapsed ? 'rotate(0deg)' : 'rotate(90deg)')};

    i {
        font-size: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const ChecklistCount = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const ChecklistItems = styled.div`
    margin-top: 8px;
    padding-left: 16px;
`;

const TaskItem = styled.div`
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);

    &:last-child {
        border-bottom: none;
    }
`;

const TaskCheckbox = styled.div`
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;

    i {
        font-size: 20px;
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }
`;

const TaskContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const TaskTitle = styled.div`
    font-size: 14px;
    color: var(--center-channel-color);
    font-weight: 500;
    margin-bottom: 4px;
`;

const TaskDescription = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    line-height: 16px;
`;

const LoadingIndicator = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-style: italic;
`;

export default PlaybookCreateWithAIModal;
