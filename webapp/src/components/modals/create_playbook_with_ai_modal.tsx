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

import {Checklist} from 'src/types/playbook';
import GenericModal from 'src/components/widgets/generic_modal';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';

const ID = 'playbooks_create_with_ai';

export const makePlaybookCreateWithAIModal = (props: PlaybookCreateWithAIModalProps) => ({
    modalId: ID,
    dialogType: PlaybookCreateWithAIModal,
    dialogProps: props,
});

export type PlaybookCreateWithAIModalProps = {
} & Partial<ComponentProps<typeof GenericModal>>;

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// Dummy conversation to showcase the UI
const DUMMY_MESSAGES: Message[] = [
    {
        role: 'user',
        content: 'Create a playbook for incident response',
        timestamp: Date.now() - 120000, // 2 minutes ago
    },
    {
        role: 'assistant',
        content: 'I\'ll help you create an incident response playbook. Here are the key tasks I\'ve generated:\n\n```json\n{\n  "checklists": [\n    {\n      "title": "Incident Detection",\n      "items": [\n        {"title": "Identify and confirm the incident"},\n        {"title": "Assess severity and priority"}\n      ]\n    }\n  ]\n}\n```',
        timestamp: Date.now() - 110000,
    },
    {
        role: 'user',
        content: 'Can you add a task for notifying stakeholders?',
        timestamp: Date.now() - 60000, // 1 minute ago
    },
    {
        role: 'assistant',
        content: 'Great idea! I\'ve added a "Notify stakeholders" task to the Communication checklist. The tasks are now updated on the right panel.',
        timestamp: Date.now() - 50000,
    },
];

// Sample checklist data matching the conversation
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

const PlaybookCreateWithAIModal = ({...modalProps}: PlaybookCreateWithAIModalProps) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const [messages, setMessages] = useState<Message[]>(DUMMY_MESSAGES);
    const [inputValue, setInputValue] = useState('');
    const [checklists, setChecklists] = useState<Checklist[]>(SAMPLE_CHECKLISTS);
    const [checklistsCollapseState, setChecklistsCollapseState] = useState<Record<number, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mockChannelId] = useState('mock_ai_channel_' + Date.now());

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
        // Use Mattermost's built-in markdown rendering
        if (formatText && messageHtmlToComponent) {
            const formattedText = formatText(content, {
                singleline: false,
                mentionHighlight: false,
            });
            return messageHtmlToComponent(formattedText);
        }
        // Fallback to plain text if Mattermost utils aren't available
        return content;
    };

    const handleSendMessage = (messageContent?: string) => {
        const content = messageContent || inputValue;
        if (!content.trim()) {
            return;
        }

        // Add user message
        const userMessage: Message = {
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');

        // Simulate AI response with mock checklist JSON
        setTimeout(() => {
            const aiMessage: Message = {
                role: 'assistant',
                content: 'I\'ll help you create a playbook for that. Here are the tasks I\'ve generated:',
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMessage]);

            // Mock checklist response - parse this from AI in the future
            const mockChecklists: Checklist[] = [
                {
                    title: 'Preparation',
                    items: [
                        {
                            title: 'Define project scope and objectives',
                            description: '',
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
                            title: 'Identify stakeholders',
                            description: '',
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
                    title: 'Execution',
                    items: [
                        {
                            title: 'Kick off team meeting',
                            description: '',
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
            setChecklists(mockChecklists);
        }, 1000);
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

    return (
        <StyledGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create playbook with AI'})}
            {...modalProps}
            confirmButtonText={formatMessage({defaultMessage: 'Create playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            isConfirmDisabled={checklists.length === 0}
            handleConfirm={() => {
                // TODO: Handle playbook creation with the generated checklists
            }}
            showCancel={true}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
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
                            disabled={!inputValue.trim()}
                        >
                            <i className='icon icon-send'/>
                        </SendButton>
                    </InputContainer>
                </LeftPanel>
                <RightPanel>
                    <TaskListHeader>
                        {formatMessage({defaultMessage: 'Generated Tasks'})}
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

    /* Mattermost's markdown rendering classes */
    pre {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        border-radius: 4px;
        padding: 12px;
        overflow-x: auto;
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
    }

    pre code {
        background: none;
        padding: 0;
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
