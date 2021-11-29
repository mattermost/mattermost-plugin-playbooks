// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {PlaybookRun} from 'src/types/playbook_run';

import {Title} from 'src/components/backstage/playbook_runs/shared';

import {StyledTextarea} from 'src/components/backstage/styles';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';
import PostText from 'src/components/post_text';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const ReportTextarea = styled(StyledTextarea)`
    margin: 8px 0 0 0;
    min-height: 200px;
    font-size: 12px;
    flex-grow: 1;
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

const SecondaryButtonSmaller = styled(SecondaryButton)`
    height: 32px;
`;

interface ReportProps {
    playbookRun: PlaybookRun;
}

const Report = (props: ReportProps) => {
    const [report, setReport] = useState(props.playbookRun.retrospective);
    const [editing, setEditing] = useState(false);
    const [publishedThisSession, setPublishedThisSession] = useState(false);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));
    const {formatMessage} = useIntl();

    const savePressed = () => {
        updateRetrospective(props.playbookRun.id, report);
        setEditing(false);
    };

    const publishPressed = () => {
        publishRetrospective(props.playbookRun.id, report);
        setEditing(false);
        setPublishedThisSession(true);
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

    return (
        <ReportContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Report'})}</Title>
                <HeaderButtonsRight>
                    <PrimaryButtonSmaller
                        onClick={publishPressed}
                    >
                        <TextContainer>{publishButtonText}</TextContainer>
                    </PrimaryButtonSmaller>
                    <EditButton
                        editing={editing}
                        onSave={savePressed}
                        onEdit={() => setEditing(true)}
                    />
                </HeaderButtonsRight>
            </Header>
            {editing &&
                <ReportTextarea
                    autoFocus={true}
                    value={report}
                    onChange={(e) => {
                        setReport(e.target.value);
                    }}
                />
            }
            {!editing &&
                <PostTextContainer>
                    <PostText
                        text={report}
                        team={team}
                    />
                </PostTextContainer>
            }
        </ReportContainer>
    );
};

interface SaveButtonProps {
    editing: boolean;
    onEdit: () => void
    onSave: () => void
}

const TextContainer = styled.span`
    display: flex;
`;

const EditButton = (props: SaveButtonProps) => {
    const {formatMessage} = useIntl();
    if (props.editing) {
        return (
            <SecondaryButtonSmaller
                onClick={props.onSave}
            >
                <TextContainer>
                    <i className={'fa fa-floppy-o'}/>
                    {formatMessage({defaultMessage: 'Save'})}
                </TextContainer>
            </SecondaryButtonSmaller>
        );
    }

    return (
        <SecondaryButtonSmaller
            onClick={props.onEdit}
        >
            <TextContainer>
                <i className={'icon icon-pencil-outline'}/>
                {formatMessage({defaultMessage: 'Edit'})}
            </TextContainer>
        </SecondaryButtonSmaller>
    );
};

export default Report;
