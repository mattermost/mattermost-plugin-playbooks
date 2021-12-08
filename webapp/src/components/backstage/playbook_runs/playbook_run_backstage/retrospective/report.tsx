// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import debounce from 'debounce';

import {PlaybookRun} from 'src/types/playbook_run';
import {Title} from 'src/components/backstage/playbook_runs/shared';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {PrimaryButton} from 'src/components/assets/buttons';
import ReportTextArea
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/report_text_area';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

const editDebounceDelayMilliseconds = 2000;

interface ReportProps {
    playbookRun: PlaybookRun;
    setRetrospective: (report: string) => void;
}

const Report = (props: ReportProps) => {
    const [publishedThisSession, setPublishedThisSession] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const {formatMessage} = useIntl();

    const confirmedPublish = () => {
        publishRetrospective(props.playbookRun.id, props.playbookRun.retrospective);
        setPublishedThisSession(true);
        setShowConfirmation(false);
    };

    let publishButtonText: React.ReactNode = formatMessage({defaultMessage: 'Publish'});
    if (publishedThisSession) {
        publishButtonText = (
            <>
                <i className={'icon icon-check'}/>
                {formatMessage({defaultMessage: 'Published'})}
            </>
        );
    } else if (props.playbookRun.retrospective_published_at && !props.playbookRun.retrospective_was_canceled) {
        publishButtonText = formatMessage({defaultMessage: 'Republish'});
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
                    <PrimaryButtonSmaller
                        onClick={() => setShowConfirmation(true)}
                    >
                        <TextContainer>{publishButtonText}</TextContainer>
                    </PrimaryButtonSmaller>
                </HeaderButtonsRight>
            </Header>
            <ReportTextArea
                teamId={props.playbookRun.team_id}
                initialText={props.playbookRun.retrospective}
                onEdit={debouncedPersistEditEvent}
                flushChanges={() => debouncedPersistEditEvent.flush()}
            />
            <ConfirmModal
                show={showConfirmation}
                title={formatMessage({defaultMessage: 'Publish retrospective'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to publish the retrospective?'})}
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
    flex-direction: row-reverse;

    > * {
        margin-left: 10px;
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

const TextContainer = styled.span`
    display: flex;
`;

export default Report;
