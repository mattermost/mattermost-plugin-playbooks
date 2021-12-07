// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import debounce from 'debounce';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {PlaybookRun} from 'src/types/playbook_run';
import {Title} from 'src/components/backstage/playbook_runs/shared';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {PrimaryButton} from 'src/components/assets/buttons';
import {useClickOutsideRef} from 'src/hooks';
import ReportTextArea
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/retrospective/report_text_area';
import PostText from 'src/components/post_text';
import RouteLeavingGuard from 'src/components/backstage/route_leaving_guard';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

// @ts-ignore
const WebappUtils = window.WebappUtils;

const editDebounceDelayMilliseconds = 2000;

interface ReportProps {
    playbookRun: PlaybookRun;
    setRetrospective: (report: string) => void;
}

const Report = (props: ReportProps) => {
    const textareaRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [publishedThisSession, setPublishedThisSession] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));
    const {formatMessage} = useIntl();

    useClickOutsideRef(textareaRef, () => setEditing(false));

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
            {
                editing &&
                <ReportTextArea
                    stopEditing={() => {
                        setEditing(false);
                        debouncedPersistEditEvent.flush();
                    }}
                    initialText={props.playbookRun.retrospective}
                    onEdit={debouncedPersistEditEvent}
                />
            }
            {
                !editing &&
                <PostTextContainer
                    data-testid={'retro-report-text'}
                    onClick={() => setEditing(true)}
                >
                    <PostText
                        text={props.playbookRun.retrospective}
                        team={team}
                    />
                </PostTextContainer>
            }
            <RouteLeavingGuard
                navigate={(path) => WebappUtils.browserHistory.push(path)}
                shouldBlockNavigation={() => editing}
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

const PostTextContainer = styled.div`
    background: var(--center-channel-bg);
    margin: 8px 0 0 0;
    padding: 10px 25px 0 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    flex-grow: 1;

    :hover {
        cursor: text;
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
