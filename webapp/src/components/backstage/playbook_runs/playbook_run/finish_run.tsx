// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import Icon from '@mdi/react';
import {mdiFlagOutline} from '@mdi/js';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {TertiaryButton} from 'src/components/assets/buttons';
import {finishRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {outstandingTasks} from 'src/components/modals/update_run_status_modal';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

export const useOnFinishRun = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return () => {
        const outstanding = outstandingTasks(playbookRun.checklists);
        let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish the run?'});
        if (outstanding > 0) {
            confirmationMessage = formatMessage(
                {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish the run?'},
                {outstanding}
            );
        }

        const onConfirm = () => {
            finishRun(playbookRun.id);
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm finish run'}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
            onConfirm,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onCancel: () => {},
        })));
    };
};

interface Props {
    playbookRun: PlaybookRun;
}

const FinishRun = ({playbookRun}: Props) => {
    const {formatMessage} = useIntl();

    const onFinishRun = useOnFinishRun(playbookRun);

    if (playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    return (
        <Container>
            <Content>
                <IconWrapper>
                    <Icon
                        path={mdiFlagOutline}
                        size={'24px'}
                    />
                </IconWrapper>
                <Text>{formatMessage({defaultMessage: 'Time to wrap up?'})}</Text>
                <RightWrapper>
                    <FinishRunButton onClick={onFinishRun}>
                        {formatMessage({defaultMessage: 'Finish run'})}
                    </FinishRunButton>
                </RightWrapper>
            </Content>
        </Container>
    );
};

export default FinishRun;

const Container = styled.div`
    margin-top: 24px;
    display: flex;
    flex-direction: column;
`;

const Content = styled.div`
    display: flex;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 12px;
    border-radius: 4px;
    height: 56px;
    align-items: center;
`;

const IconWrapper = styled.div`
    margin-left: 4px;
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;
const Text = styled.div`
    margin: 0 4px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    display: flex;
`;

const RightWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;
`;

const FinishRunButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 32px;
`;

