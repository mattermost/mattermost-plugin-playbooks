// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';

import GenericModal from 'src/components/widgets/generic_modal';
import {QuicklistModalProps} from 'src/types/quicklist';
import {useQuicklistGenerate} from 'src/hooks';
import QuicklistSection from 'src/components/quicklist/quicklist_section';

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
    const {isLoading, data, error} = useQuicklistGenerate(postId);

    const hasChecklists = data && data.checklists && data.checklists.length > 0;

    return (
        <StyledGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Run from Thread'})}
            showCancel={true}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Create Run'})}
            isConfirmDisabled={isLoading || !hasChecklists}
            handleConfirm={() => {
                // Phase 3: Will implement run creation using channelId and data
                // eslint-disable-next-line no-console
                console.log('Create run in channel:', channelId, 'with data:', data);
            }}
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

export default QuicklistModal;
