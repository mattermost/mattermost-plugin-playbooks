// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import GenericModal from 'src/components/widgets/generic_modal';
import {QuicklistModalProps} from 'src/types/quicklist';

const ID = 'playbooks_quicklist_modal';

type Props = QuicklistModalProps & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: QuicklistModal,
    dialogProps: props,
});

/**
 * Modal for displaying AI-generated quicklist from a conversation thread.
 * Phase 1: Shows loading state.
 * Phase 2: Will display generated checklist with feedback input.
 */
const QuicklistModal = ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    postId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelId,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();

    // Phase 1: Always show loading state
    // Phase 2: Will use postId and channelId to call generate API
    const [loading] = useState(true);

    return (
        <StyledGenericModal
            id={ID}
            modalHeaderText={formatMessage({defaultMessage: 'Create Run from Thread'})}
            showCancel={true}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Create Run'})}
            isConfirmDisabled={loading}
            handleConfirm={() => {
                // Phase 3: Will implement run creation
            }}
            {...modalProps}
        >
            <Body>
                {loading && (
                    <LoadingContainer data-testid='quicklist-loading'>
                        <Spinner/>
                        <LoadingText>
                            {formatMessage({defaultMessage: 'Analyzing thread...'})}
                        </LoadingText>
                    </LoadingContainer>
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

export default QuicklistModal;
