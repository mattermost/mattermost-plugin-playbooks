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
import {getCurrentUserId, getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useHistory} from 'react-router-dom';
import {Client4} from 'mattermost-redux/client';

import {Checklist, DraftPlaybookWithChecklist, setPlaybookDefaults} from 'src/types/playbook';
import GenericModal from 'src/components/widgets/generic_modal';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {sendAIPlaybookMessage, AIPost, savePlaybook, clientFetchPlaybook, fetchAIBots, AIBotsResponse} from 'src/client';
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
    files?: File[];
}

const PlaybookCreateWithAIModal = ({initialPlaybookId, ...modalProps}: PlaybookCreateWithAIModalProps) => {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const currentUserId = useSelector(getCurrentUserId);
    const currentUser = useSelector(getCurrentUser);
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
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [playbookDescription, setPlaybookDescription] = useState('');
    const [aiBotsData, setAIBotsData] = useState<AIBotsResponse | null>(null);
    const [selectedBotUsername, setSelectedBotUsername] = useState<string>('');
    const [selectedBotId, setSelectedBotId] = useState<string>('');

    // Load existing playbook if an ID is provided
    useEffect(() => {
        if (initialPlaybookId) {
            clientFetchPlaybook(initialPlaybookId).then((playbook) => {
                if (playbook) {
                    setExistingPlaybook(playbook);
                    setPlaybookName(playbook.title);
                    setPlaybookDescription(playbook.description || '');
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

    // Fetch AI bots on modal mount
    useEffect(() => {
        fetchAIBots().then((botsData) => {
            setAIBotsData(botsData);
            // Select the first bot if available
            if (botsData.bots.length > 0) {
                const firstBot = botsData.bots[0];
                setSelectedBotUsername(firstBot.username);
                setSelectedBotId(firstBot.id);
            }
        }).catch((err) => {
            console.error('Failed to fetch AI bots:', err);
            // Note: No fallback ID set - avatar will fail gracefully with fallback icon
        });
    }, []);

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

    const parsePlaybookSchema = (message: string): {checklists: Checklist[]; title?: string; description?: string} | null => {
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

            // Return the checklists along with optional title and description
            return {
                checklists: parsed.checklists as Checklist[],
                title: parsed.title,
                description: parsed.description,
            };
        } catch (err) {
            console.error('Failed to parse playbook schema JSON:', err);
            return null;
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const validFiles = newFiles.filter((file) => {
                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    setError(`File "${file.name}" is too large (max 10MB)`);
                    return false;
                }
                return true;
            });

            // Check total file count
            if (attachedFiles.length + validFiles.length > 5) {
                setError('Maximum 5 files allowed');
                // Reset input value so the same file can be selected again
                e.target.value = '';
                return;
            }

            setAttachedFiles((prev) => [...prev, ...validFiles]);

            // Reset input value so the same file can be selected again
            e.target.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        }
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSendMessage = async (messageContent?: string) => {
        const content = messageContent || inputValue;
        if ((!content.trim() && attachedFiles.length === 0) || isLoading) {
            return;
        }

        // Clear any previous errors
        setError(null);

        // Store files for request, then clear
        const filesToSend = [...attachedFiles];

        // Add user message with files
        const userMessage: Message = {
            role: 'user',
            content: content || (filesToSend.length > 0 ? '[Attached files]' : ''),
            timestamp: Date.now(),
            files: filesToSend.length > 0 ? filesToSend : undefined,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setAttachedFiles([]);
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
            } else if (messages.length > 1 && (checklists.length > 0 || playbookName || playbookDescription)) {
                // For subsequent messages, include the current state so the AI can modify it
                const currentStateJson = JSON.stringify({
                    title: playbookName || 'Untitled Playbook',
                    description: playbookDescription || '',
                    checklists,
                }, null, 2);

                const stateContext: AIPost = {
                    role: 'user',
                    message: `IMPORTANT: Here is the current playbook state that you previously generated. When the user asks you to modify it, you MUST output a new complete playbook schema using the <!-- PLAYBOOK_SCHEMA --> marker and JSON format, incorporating the requested changes:\n\n\`\`\`json\n${currentStateJson}\n\`\`\`\n\nUser's request: ${content}\n\nRemember: Output the updated playbook using <!-- PLAYBOOK_SCHEMA --> followed by a JSON code block.`,
                };

                // Replace the last user message with the enhanced version
                conversationHistory = conversationHistory.map((msg, idx) => {
                    if (idx === conversationHistory.length - 1) {
                        return stateContext;
                    }
                    return msg;
                });
            }

            // Send request to AI service with files
            const aiResponse = await sendAIPlaybookMessage(conversationHistory, filesToSend);

            // Add AI response to messages
            const aiMessage: Message = {
                role: 'assistant',
                content: aiResponse,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, aiMessage]);

            // Try to parse playbook schema from the response
            const parsedSchema = parsePlaybookSchema(aiResponse);
            if (parsedSchema) {
                // Update the checklists with the parsed schema
                setChecklists(parsedSchema.checklists);

                // Update title if provided
                if (parsedSchema.title) {
                    setPlaybookName(parsedSchema.title);
                }

                // Update description if provided
                if (parsedSchema.description) {
                    setPlaybookDescription(parsedSchema.description);
                }
            }
            // If no schema found, that's fine - it's just a conversational message

        } catch (err) {
            // Handle error
            let errorMessage = err instanceof Error ? err.message : 'Failed to get response from AI';

            // Check if it's a vision-related error
            if (errorMessage.includes('image_url') || errorMessage.includes('vision')) {
                errorMessage = 'This AI bot does not support image uploads. Please configure the bot to use a vision-enabled model or upload text files only.';
            }

            setError(errorMessage);

            // Add error message to chat
            const errorChatMessage: Message = {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${errorMessage}`,
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
                    description: playbookDescription,
                    checklists,
                    num_stages: checklists.length,
                    num_steps: checklists.reduce((sum, cl) => sum + cl.items.length, 0),
                };
            } else {
                // Create a draft playbook with the AI-generated checklists
                draftPlaybook = {
                    title: playbookName,
                    description: playbookDescription || 'Playbook created with AI assistance',
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

    const modalHeaderText = playbookName;

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
                                            <>
                                                {selectedBotId && (
                                                    <BotAvatarImage
                                                        src={`${Client4.getBaseRoute()}/users/${selectedBotId}/image?_=${Date.now()}`}
                                                        alt='AI Assistant'
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const nextSibling = e.currentTarget.nextElementSibling;
                                                            if (nextSibling) {
                                                                (nextSibling as HTMLElement).style.display = 'flex';
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <UserAvatarImage
                                                src={`${Client4.getBaseRoute()}/users/${currentUserId}/image?_=${Date.now()}`}
                                                alt={currentUser?.username || 'You'}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const nextSibling = e.currentTarget.nextElementSibling;
                                                    if (nextSibling) {
                                                        (nextSibling as HTMLElement).style.display = 'flex';
                                                    }
                                                }}
                                            />
                                        )}
                                        <AvatarFallback style={{display: selectedBotId || message.role !== 'assistant' ? 'none' : 'flex'}}>
                                            {message.role === 'assistant' ? (
                                                <i className='icon icon-robot-outline'/>
                                            ) : (
                                                <i className='icon icon-account-outline'/>
                                            )}
                                        </AvatarFallback>
                                    </Avatar>
                                    <PostMeta>
                                        <Username>
                                            {message.role === 'assistant' ? selectedBotUsername : (currentUser?.username || 'You')}
                                        </Username>
                                        <PostTime>
                                            {formatTime(message.timestamp)}
                                        </PostTime>
                                    </PostMeta>
                                </PostHeader>
                                <PostBody>
                                    {renderMessageContent(message.content)}
                                    {message.files && message.files.length > 0 && (
                                        <MessageFilesContainer>
                                            {message.files.map((file, fileIndex) => (
                                                <MessageFileChip key={fileIndex}>
                                                    {file.type.startsWith('image/') ? (
                                                        <FileImagePreview
                                                            src={URL.createObjectURL(file)}
                                                            alt={file.name}
                                                        />
                                                    ) : (
                                                        <i className='icon icon-file-document-outline'/>
                                                    )}
                                                    <MessageFileInfo>
                                                        <MessageFileName>{file.name}</MessageFileName>
                                                        <MessageFileSize>{formatFileSize(file.size)}</MessageFileSize>
                                                    </MessageFileInfo>
                                                </MessageFileChip>
                                            ))}
                                        </MessageFilesContainer>
                                    )}
                                </PostBody>
                            </PostContainer>
                        ))}
                        {isLoading && (
                            <PostContainer>
                                <PostHeader>
                                    <Avatar $isBot={true}>
                                        {selectedBotId && (
                                            <BotAvatarImage
                                                src={`${Client4.getBaseRoute()}/users/${selectedBotId}/image?_=${Date.now()}`}
                                                alt='AI Assistant'
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const nextSibling = e.currentTarget.nextElementSibling;
                                                    if (nextSibling) {
                                                        (nextSibling as HTMLElement).style.display = 'flex';
                                                    }
                                                }}
                                            />
                                        )}
                                        <AvatarFallback style={{display: selectedBotId ? 'none' : 'flex'}}>
                                            <i className='icon icon-robot-outline'/>
                                        </AvatarFallback>
                                    </Avatar>
                                    <PostMeta>
                                        <Username>{selectedBotUsername}</Username>
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
                        <input
                            ref={fileInputRef}
                            type='file'
                            multiple={true}
                            accept='image/*,.pdf,.txt,.doc,.docx'
                            style={{display: 'none'}}
                            onChange={handleFileSelect}
                        />
                        {attachedFiles.length > 0 && (
                            <FilePreviewContainer>
                                {attachedFiles.map((file, index) => (
                                    <FileChip key={index}>
                                        <i className='icon icon-file-document-outline'/>
                                        <FileInfo>
                                            <FileName>{file.name}</FileName>
                                            <FileSize>{formatFileSize(file.size)}</FileSize>
                                        </FileInfo>
                                        <RemoveFileButton
                                            onClick={() => handleRemoveFile(index)}
                                            aria-label='Remove file'
                                        >
                                            <i className='icon icon-close'/>
                                        </RemoveFileButton>
                                    </FileChip>
                                ))}
                            </FilePreviewContainer>
                        )}
                        <InputRow>
                            <TextInputWrapper>
                                <TextInput
                                    placeholder={formatMessage({defaultMessage: 'Describe the playbook you want to create...'})}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                />
                                <AttachButton
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading || attachedFiles.length >= 5}
                                    aria-label='Attach file'
                                >
                                    <i className='icon icon-paperclip'/>
                                </AttachButton>
                                <SendButton
                                    onClick={() => handleSendMessage()}
                                    disabled={(!inputValue.trim() && attachedFiles.length === 0) || isLoading}
                                >
                                    {isLoading ? (
                                        <i className='icon icon-loading icon-spin'/>
                                    ) : (
                                        <i className='icon icon-send'/>
                                    )}
                                </SendButton>
                            </TextInputWrapper>
                        </InputRow>
                    </InputContainer>
                </LeftPanel>
                <RightPanel>
                    <TaskListHeader>
                        {formatMessage({defaultMessage: 'Playbook Tasks'})}
                    </TaskListHeader>
                    {playbookDescription && (
                        <DescriptionContainer>
                            <DescriptionLabel>
                                {formatMessage({defaultMessage: 'Description'})}
                            </DescriptionLabel>
                            <DescriptionText>
                                {playbookDescription}
                            </DescriptionText>
                        </DescriptionContainer>
                    )}
                    <TaskListContainer>
                        {checklists.length === 0 || (checklists.length === 1 && checklists[0].items.length === 1 && checklists[0].items[0].title === '') ? (
                            <EmptyTaskState>
                                <EmptyStateIcon>
                                    <i className='icon icon-format-list-checks'/>
                                </EmptyStateIcon>
                                <EmptyStateTitle>
                                    {formatMessage({defaultMessage: 'No tasks yet'})}
                                </EmptyStateTitle>
                                <EmptyStateDescription>
                                    {formatMessage({defaultMessage: 'Start a conversation with AI to generate your playbook tasks. Try describing the type of workflow you want to automate.'})}
                                </EmptyStateDescription>
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
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    flex-shrink: 0; /* Prevent header from shrinking */
`;

const TaskListHeader = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    font-weight: 600;
    font-size: 14px;
    color: var(--center-channel-color);
    flex-shrink: 0; /* Prevent header from shrinking */
`;

const DescriptionContainer = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    flex-shrink: 0;
`;

const DescriptionLabel = styled.div`
    font-weight: 600;
    font-size: 12px;
    color: var(--center-channel-color);
    margin-bottom: 8px;
    letter-spacing: 0.02em;
`;

const DescriptionText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
`;

const MessagesContainer = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px 20px;
    text-align: center;
`;

const EmptyStateIcon = styled.div`
    font-size: 48px;
    color: rgba(var(--center-channel-color-rgb), 0.32);
    margin-bottom: 16px;

    i {
        font-size: 48px;
    }
`;

const EmptyStateTitle = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
    margin-bottom: 8px;
`;

const EmptyStateDescription = styled.div`
    font-size: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    line-height: 20px;
    max-width: 400px;
`;

const PostContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 8px 0;

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
    overflow: hidden;
    position: relative;

    i {
        font-size: 18px;
        color: ${({$isBot}) => ($isBot ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    }
`;

const BotAvatarImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
`;

const UserAvatarImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
`;

const AvatarFallback = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
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
    margin-left: 32px;
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
    flex-direction: column;
    padding: 16px;
    gap: 8px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    flex-shrink: 0; /* Prevent input from being pushed out of view */
`;

const TextInputWrapper = styled.div`
    flex: 1;
    position: relative;
    display: flex;
    align-items: flex-end;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    padding: 8px 8px 8px 12px;

    &:focus-within {
        border-color: var(--button-bg);
        box-shadow: 0 0 0 2px rgba(var(--button-bg-rgb), 0.12);
    }
`;

const TextInput = styled.textarea`
    flex: 1;
    border: none;
    background: transparent;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    resize: none;
    min-height: 20px;
    max-height: 100px;
    font-family: inherit;
    padding: 0;

    &:focus {
        outline: none;
    }

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const SendButton = styled.button`
    padding: 0;
    border: none;
    border-radius: 4px;
    background: ${props => props.disabled ? 'rgba(var(--button-bg-rgb), 0.32)' : 'var(--button-bg)'};
    color: var(--button-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    transition: all 0.15s ease;
    margin-left: 8px;

    &:hover:not(:disabled) {
        background: rgba(var(--button-bg-rgb), 0.92);
    }

    &:disabled {
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

// File upload components
const InputRow = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 8px;
`;

const AttachButton = styled.button`
    padding: 0;
    border: none;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        color: var(--center-channel-color);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    i {
        font-size: 20px;
    }
`;

const FilePreviewContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
`;

const FileChip = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    max-width: 250px;

    i.icon-file-document-outline {
        font-size: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        flex-shrink: 0;
    }
`;

const FileInfo = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
`;

const FileName = styled.div`
    font-size: 12px;
    color: var(--center-channel-color);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const FileSize = styled.div`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const RemoveFileButton = styled.button`
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    flex-shrink: 0;

    &:hover {
        color: var(--error-text);
    }

    i {
        font-size: 16px;
    }
`;

// Message file display components
const MessageFilesContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
`;

const MessageFileChip = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    max-width: 300px;

    i.icon-file-document-outline {
        font-size: 24px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        flex-shrink: 0;
    }
`;

const FileImagePreview = styled.img`
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
`;

const MessageFileInfo = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
`;

const MessageFileName = styled.div`
    font-size: 12px;
    color: var(--center-channel-color);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const MessageFileSize = styled.div`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

export default PlaybookCreateWithAIModal;
