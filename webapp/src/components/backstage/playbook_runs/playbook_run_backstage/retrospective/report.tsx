// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl, FormattedMessage} from 'react-intl';
import debounce from 'debounce';
import {DateTime} from 'luxon';

import {Timestamp} from 'src/webapp_globals';

import {PlaybookRun} from 'src/types/playbook_run';
import {Title} from 'src/components/backstage/playbook_runs/shared';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {PrimaryButton} from 'src/components/assets/buttons';
import ReportTextArea
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/report_text_area';
import ConfirmModalLight from 'src/components/widgets/confirmation_modal_light';

const editDebounceDelayMilliseconds = 2000;

interface ReportProps {
    playbookRun: PlaybookRun;
    setRetrospective: (report: string) => void;
}

const PUB_TIME = {
    useTime: false,
    units: [
        {within: ['second', -45], display: <FormattedMessage defaultMessage='just now'/>},
        ['minute', -59],
        ['hour', -48],
        ['day', -30],
        ['month', -12],
        'year',
    ],
};

const Report = (props: ReportProps) => {
    // we are creating the local state for this session to avoid get request
    const [publishedThisSession, setPublishedThisSession] = useState(false);
    const [publishedAtThisSession, setPublishedAtThisSession] = useState(0);

    const [showConfirmation, setShowConfirmation] = useState(false);
    const {formatMessage} = useIntl();

    const confirmedPublish = () => {
        publishRetrospective(props.playbookRun.id, props.playbookRun.retrospective);
        setPublishedThisSession(true);
        setPublishedAtThisSession(DateTime.now().valueOf());
        setShowConfirmation(false);
    };

    const publishButtonText: React.ReactNode = formatMessage({defaultMessage: 'Publish'});
    let publishComponent = (
        <PrimaryButtonSmaller
            onClick={() => setShowConfirmation(true)}
        >
            <TextContainer>{publishButtonText}</TextContainer>
        </PrimaryButtonSmaller>
    );

    const isPublished = publishedThisSession || props.playbookRun.retrospective_published_at > 0;
    if (isPublished) {
        const publishedAt = (
            <Timestamp
                value={publishedAtThisSession || props.playbookRun.retrospective_published_at}
                {...PUB_TIME}
            />
        );
        publishComponent = (
            <>
                <i className={'icon icon-check-all'}/>
                <span>{''}</span>
                {formatMessage({defaultMessage: 'Published {timestamp}'}, {timestamp: publishedAt})}
                <DisabledPrimaryButtonSmaller>
                    <TextContainer>{publishButtonText}</TextContainer>
                </DisabledPrimaryButtonSmaller>
            </>
        );
    }

    const persistEditEvent = (text: string) => {
        updateRetrospective(props.playbookRun.id, text);
        props.setRetrospective(text);
    };
    const debouncedPersistEditEvent = debounce(persistEditEvent, editDebounceDelayMilliseconds);

    return (
        <ReportContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Report'})}</Title>
                <HeaderButtonsRight>
                    {publishComponent}
                </HeaderButtonsRight>
            </Header>
            <ReportTextArea
                teamId={props.playbookRun.team_id}
                text={props.playbookRun.retrospective}
                isEditable={!isPublished}
                onEdit={debouncedPersistEditEvent}
                flushChanges={() => debouncedPersistEditEvent.flush()}
            />
            <ConfirmModalLight
                show={showConfirmation}
                title={formatMessage({defaultMessage: 'Are you sure you want to publish'})}
                message={formatMessage({defaultMessage: 'You will not be able to edit the retrospective report after publishing it. Do you want to publish the retrospective report?'})}
                confirmButtonText={formatMessage({defaultMessage: 'Publish'})}
                onConfirm={confirmedPublish}
                onCancel={() => setShowConfirmation(false)}
            />
        </ReportContainer>
    );
};

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const HeaderButtonsRight = styled.div`
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    > * {
        margin-left: 4px;
    }
`;

const ReportContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-bottom: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
`;

const PrimaryButtonSmaller = styled(PrimaryButton)`
    height: 32px;
`;

const DisabledPrimaryButtonSmaller = styled(PrimaryButtonSmaller)`
    background: rgba(var(--center-channel-color-rgb),0.08);
    color: rgba(var(--center-channel-color-rgb),0.32);
    margin-left: 16px;
    cursor: default;

    &:active:not([disabled])  {
        background: rgba(var(--center-channel-color-rgb),0.08);
    }

    &:hover:enabled {
        background: rgba(var(--center-channel-color-rgb),0.08);
        cursor: default;
    }
`;

const TextContainer = styled.span`
    display: flex;
`;

export default Report;
