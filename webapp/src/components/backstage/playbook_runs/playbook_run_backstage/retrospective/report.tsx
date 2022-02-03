// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';
import {useIntl} from 'react-intl';
import debounce from 'debounce';

import {PlaybookRun} from 'src/types/playbook_run';
import {updateRetrospective} from 'src/client';
import ReportTextArea
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/report_text_area';

const editDebounceDelayMilliseconds = 2000;

interface ReportProps {
    playbookRun: PlaybookRun;
    isPublished: boolean;
    setRetrospective: (report: string) => void;
}

const Report = (props: ReportProps) => {
    const {formatMessage} = useIntl();

    const persistEditEvent = (text: string) => {
        updateRetrospective(props.playbookRun.id, text);
        props.setRetrospective(text);
    };
    const debouncedPersistEditEvent = debounce(persistEditEvent, editDebounceDelayMilliseconds);

    return (
        <ReportContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Report'})}</Title>
            </Header>
            <ReportTextArea
                teamId={props.playbookRun.team_id}
                text={props.playbookRun.retrospective}
                isEditable={!props.isPublished}
                onEdit={debouncedPersistEditEvent}
                flushChanges={() => debouncedPersistEditEvent.flush()}
            />
        </ReportContainer>
    );
};

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const ReportContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-bottom: 20px;
    margin-top: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
`;

const Title = styled.div`
    font-weight: 600;
    font-size: 14px;
`;

export default Report;
