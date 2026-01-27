// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {ClientError} from '@mattermost/client';

import GenericModal from 'src/components/widgets/generic_modal';
import {QuicklistGenerateResponse, QuicklistModalProps} from 'src/types/quicklist';
import {useQuicklistGenerate} from 'src/hooks';
import QuicklistSection from 'src/components/quicklist/quicklist_section';
import {
    clientAddChecklist,
    clientAddChecklistItem,
    clientRenameChecklist,
    createPlaybookRun,
    refineQuicklist,
} from 'src/client';
import {navigateToPluginUrl} from 'src/browser_routing';

const ID = 'playbooks_quicklist_modal';

type Props = QuicklistModalProps & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: QuicklistModal,
    dialogProps: props,
});

/**
 * Modal for displaying AI-generated quicklist from a conversation thread.
 * Displays generated checklist with sections and items, thread info,
 * and truncation warnings when applicable.
 */
const QuicklistModal = ({
    postId,
    channelId,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const {isLoading, data: initialData, error: generateError} = useQuicklistGenerate(postId);

    // Local state for the current checklist data (can be updated via refinement)
    const [currentData, setCurrentData] = useState<QuicklistGenerateResponse | null>(null);
    const [feedback, setFeedback] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [refineError, setRefineError] = useState<ClientError | null>(null);
    const [isCreatingRun, setIsCreatingRun] = useState(false);
    const [createError, setCreateError] = useState<ClientError | null>(null);

    // Use currentData if we've refined, otherwise use initial data
    const data = currentData || initialData;
    const error = createError || refineError || generateError;

    const hasChecklists = data && data.checklists && data.checklists.length > 0;

    /**
     * Creates a playbook run from the generated checklist.
     * Strategy:
     * 1. Create run with empty playbook_id (creates RunTypeChannelChecklist with default "Tasks" checklist)
     * 2. Rename default checklist at index 0 to first section title
     * 3. Add items to first checklist
     * 4. For each additional section: create new checklist, add items
     * 5. Navigate to run view
     */
    const handleCreateRun = async () => {
        if (!data || !hasChecklists) {
            return;
        }

        setIsCreatingRun(true);
        setCreateError(null);

        try {
            // Step 1: Create the run without playbook_id (channel checklist type)
            const run = await createPlaybookRun(
                '', // empty playbook_id = RunTypeChannelChecklist
                currentUserId,
                currentTeamId,
                data.title,
                '', // summary
                channelId,
            );

            // Step 2-4: Populate checklists (sequential execution required)
            // eslint-disable-next-line no-await-in-loop
            for (let i = 0; i < data.checklists.length; i++) {
                const checklist = data.checklists[i];

                if (i === 0) {
                    // Rename the default "Tasks" checklist to first section title
                    // eslint-disable-next-line no-await-in-loop
                    await clientRenameChecklist(run.id, 0, checklist.title);
                } else {
                    // Create additional checklists for subsequent sections
                    // eslint-disable-next-line no-await-in-loop
                    await clientAddChecklist(run.id, {
                        title: checklist.title,
                        items: [],
                    });
                }

                // Add items to this checklist
                for (const item of checklist.items) {
                    // eslint-disable-next-line no-await-in-loop
                    await clientAddChecklistItem(run.id, i, item);
                }
            }

            // Step 5: Navigate to run view and close modal
            navigateToPluginUrl(`/runs/${run.id}?from=quicklist`);

            // Close modal via the onHide prop
            if (modalProps.onHide) {
                modalProps.onHide();
            }
        } catch (err) {
            if (err instanceof ClientError) {
                setCreateError(err);
            } else {
                setCreateError(new ClientError('', {
                    message: err instanceof Error ? err.message : 'Failed to create run',
                    status_code: 0,
                    url: '',
                }));
            }
        } finally {
            setIsCreatingRun(false);
        }
    };

    const handleFeedbackSubmit = async () => {
        if (!feedback.trim() || !data?.checklists) {
            return;
        }

        setIsRefining(true);
        setRefineError(null);

        try {
            const result = await refineQuicklist({
                post_id: postId,
                current_checklists: data.checklists,
                feedback: feedback.trim(),
            });
            setCurrentData(result);
            setFeedback('');
        } catch (err) {
            if (err instanceof ClientError) {
                setRefineError(err);
            } else {
                setRefineError(new ClientError('', {
                    message: err instanceof Error ? err.message : 'An unexpected error occurred',
                    status_code: 0,
                    url: '',
                }));
            }
        } finally {
            setIsRefining(false);
        }
    };

    const handleFeedbackKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleFeedbackSubmit();
        }
    };

    return (
        <StyledGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Run from Thread'})}
            showCancel={true}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={isCreatingRun ?
                formatMessage({defaultMessage: 'Creating...'}) :
                formatMessage({defaultMessage: 'Create Run'})}
            isConfirmDisabled={isLoading || isCreatingRun || !hasChecklists}
            handleConfirm={handleCreateRun}
            {...modalProps}
        >
            <Body>
                {isLoading && (
                    <LoadingContainer data-testid='quicklist-loading'>
                        <Spinner/>
                        <LoadingText>
                            {formatMessage({defaultMessage: 'Analyzing thread...'})}
                        </LoadingText>
                    </LoadingContainer>
                )}

                {error && (
                    <ErrorContainer data-testid='quicklist-error'>
                        <ErrorIcon className='icon-alert-circle-outline icon-24'/>
                        <ErrorText>
                            {error.message || formatMessage({defaultMessage: 'Failed to generate checklist. Please try again.'})}
                        </ErrorText>
                    </ErrorContainer>
                )}

                {!isLoading && !error && data && (
                    <>
                        {data.thread_info?.truncated && (
                            <TruncationWarning data-testid='quicklist-truncation-warning'>
                                <WarningIcon className='icon-alert-outline icon-16'/>
                                <FormattedMessage
                                    defaultMessage='Thread was truncated ({count} messages not analyzed)'
                                    values={{count: data.thread_info.truncated_count}}
                                />
                            </TruncationWarning>
                        )}

                        <ThreadInfoBar data-testid='quicklist-thread-info'>
                            <FormattedMessage
                                defaultMessage='{messageCount} messages analyzed from {participantCount} participants'
                                values={{
                                    messageCount: data.thread_info?.message_count ?? 0,
                                    participantCount: data.thread_info?.participant_count ?? 0,
                                }}
                            />
                        </ThreadInfoBar>

                        <RunTitle data-testid='quicklist-title'>
                            {data.title}
                        </RunTitle>

                        {hasChecklists ? (
                            <ChecklistsContainer data-testid='quicklist-checklists'>
                                {isRefining && (
                                    <RefiningOverlay data-testid='quicklist-refining'>
                                        <Spinner/>
                                        <RefiningText>
                                            {formatMessage({defaultMessage: 'Updating checklist...'})}
                                        </RefiningText>
                                    </RefiningOverlay>
                                )}
                                {data.checklists.map((checklist, index) => (
                                    <QuicklistSection
                                        key={checklist.id || `section-${index}`}
                                        checklist={checklist}
                                    />
                                ))}
                            </ChecklistsContainer>
                        ) : (
                            <EmptyState data-testid='quicklist-empty'>
                                <FormattedMessage
                                    defaultMessage='No action items could be identified in this thread.'
                                />
                            </EmptyState>
                        )}

                        {hasChecklists && (
                            <FeedbackSection data-testid='quicklist-feedback-section'>
                                <FeedbackInputContainer>
                                    <FeedbackInput
                                        data-testid='quicklist-feedback-input'
                                        placeholder={formatMessage({defaultMessage: 'Describe changes you want to make...'})}
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        onKeyDown={handleFeedbackKeyDown}
                                        disabled={isRefining}
                                        rows={1}
                                    />
                                    <SendButton
                                        data-testid='quicklist-feedback-send'
                                        onClick={handleFeedbackSubmit}
                                        disabled={!feedback.trim() || isRefining}
                                        aria-label={formatMessage({defaultMessage: 'Send feedback'})}
                                    >
                                        <i className='icon-send icon-16'/>
                                    </SendButton>
                                </FeedbackInputContainer>
                                <FeedbackHint>
                                    <FormattedMessage
                                        defaultMessage='Press Enter to send, Shift+Enter for new line'
                                    />
                                </FeedbackHint>
                            </FeedbackSection>
                        )}
                    </>
                )}
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        .modal-header {
            padding: 24px 31px;
            margin-bottom: 0;
            box-shadow: inset 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.16);
        }

        .modal-body {
            padding: 24px 31px;
            min-height: 300px;
            max-height: 70vh;
            overflow-y: auto;
        }

        .modal-footer {
            padding: 0 31px 28px;
        }

        .modal-content {
            width: 600px;
            max-width: 100%;
        }
    }
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
`;

const LoadingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
`;

const Spinner = styled.div`
    width: 32px;
    height: 32px;
    border: 3px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-top-color: var(--button-bg);
    border-radius: 50%;
    animation: spin 1s linear infinite;

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
`;

const LoadingText = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ErrorContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 12px;
`;

const ErrorIcon = styled.i`
    color: var(--error-text);
`;

const ErrorText = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: var(--error-text);
    text-align: center;
`;

const TruncationWarning = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(var(--away-indicator-rgb), 0.08);
    border: 1px solid rgba(var(--away-indicator-rgb), 0.16);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    font-weight: 400;
    line-height: 18px;
    color: var(--center-channel-color);
`;

const WarningIcon = styled.i`
    color: var(--away-indicator);
    flex-shrink: 0;
`;

const ThreadInfoBar = styled.div`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-bottom: 16px;
`;

const RunTitle = styled.h2`
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);
    margin: 0 0 16px;
`;

const ChecklistsContainer = styled.div`
    display: flex;
    flex-direction: column;
    position: relative;
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: center;
`;

const RefiningOverlay = styled.div`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(var(--center-channel-bg-rgb), 0.8);
    z-index: 10;
    gap: 12px;
`;

const RefiningText = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const FeedbackSection = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FeedbackInputContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: 8px;
`;

const FeedbackInput = styled.textarea`
    flex: 1;
    min-height: 36px;
    max-height: 120px;
    padding: 8px 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    resize: none;
    overflow-y: auto;

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    &:focus {
        outline: none;
        border-color: var(--button-bg);
        box-shadow: 0 0 0 1px var(--button-bg);
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.04);
        cursor: not-allowed;
    }
`;

const SendButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--button-bg);
    color: var(--button-color);
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover:not(:disabled) {
        opacity: 0.92;
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
        cursor: not-allowed;
    }

    i {
        font-size: 16px;
    }
`;

const FeedbackHint = styled.div`
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-top: 4px;
`;

export default QuicklistModal;
