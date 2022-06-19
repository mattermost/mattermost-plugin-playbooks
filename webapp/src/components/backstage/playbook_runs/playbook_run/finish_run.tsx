// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import Icon from '@mdi/react';
import {mdiFlagOutline} from '@mdi/js';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {TertiaryButton} from 'src/components/assets/buttons';

interface Props {
    playbookRun: PlaybookRun;
}

const FinishRun = ({playbookRun}: Props) => {
    const {formatMessage} = useIntl();

    if (playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    // TODO: plug endpoint when client is ready
    const onFinishRun = () => null;

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

