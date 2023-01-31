// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {useUpdateRun} from 'src/graphql/hooks';
import MarkdownEdit from 'src/components/markdown_edit';
import {Timestamp} from 'src/webapp_globals';
import {AnchorLinkTitle, Role} from 'src/components/backstage/playbook_runs/shared';
import {PAST_TIME_SPEC} from 'src/components/time_spec';

interface Props {
    id: string;
    role: Role
    runID: string
    summaryModifiedAt: number
    endAt: number
    summary: string
}

const Summary = (props: Props) => {
    const {formatMessage} = useIntl();
    const updateRun = useUpdateRun(props.runID);

    const title = formatMessage({defaultMessage: 'Summary'});
    const modifiedAt = (
        <Timestamp
            value={props.summaryModifiedAt}
            units={PAST_TIME_SPEC}
        />
    );

    const modifiedAtMessage = (
        <TimestampContainer>
            {formatMessage({defaultMessage: 'Last edited {timestamp}'}, {timestamp: modifiedAt})}
        </TimestampContainer>
    );

    const placeholder = props.role === Role.Participant ? formatMessage({defaultMessage: 'Add a run summary'}) : formatMessage({defaultMessage: 'There\'s no summary'});
    const disabled = (Role.Viewer === props.role || props.endAt > 0);

    return (
        <Container
            id={props.id}
            data-testid={'run-summary-section'}
        >
            <Header>
                <AnchorLinkTitle
                    title={title}
                    id={props.id}
                />
                {props.summaryModifiedAt > 0 && modifiedAtMessage}
            </Header>
            <MarkdownEdit
                disabled={disabled}
                placeholder={placeholder}
                value={props.summary}
                onSave={(value) => {
                    updateRun({summary: value});
                }}
            />
        </Container>
    );
};

export default Summary;

const Header = styled.div`
    display: flex;
    flex: 1;
    margin-bottom: 8px;
`;

const TimestampContainer = styled.div`
    flex-grow: 1;
    display: flex;
    white-space: pre-wrap;

    align-items: center;
    justify-content: flex-end;

    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    margin-top: 24px;
`;
