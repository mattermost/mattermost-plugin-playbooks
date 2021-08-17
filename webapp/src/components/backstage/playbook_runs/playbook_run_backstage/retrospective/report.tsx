// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {PlaybookRun} from 'src/types/playbook_run';

import {
    Title,
    SecondaryButtonSmaller,
} from 'src/components/backstage/playbook_runs/shared';

import {StyledTextarea} from 'src/components/backstage/styles';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {PrimaryButton} from 'src/components/assets/buttons';
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

const CustomPrimaryButton = styled(PrimaryButton)`
    height: 26px;
    font-size: 12px;
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
    border: 1px solid var(--center-channel-color-08);
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

interface ReportProps {
    playbookRun: PlaybookRun;
}

const Report = (props: ReportProps) => {
    const [report, setReport] = useState(props.playbookRun.retrospective);
    const [editing, setEditing] = useState(false);
    const [publishedThisSession, setPublishedThisSession] = useState(false);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));

    const savePressed = () => {
        updateRetrospective(props.playbookRun.id, report);
        setEditing(false);
    };

    const publishPressed = () => {
        publishRetrospective(props.playbookRun.id, report);
        setEditing(false);
        setPublishedThisSession(true);
    };

    let publishButtonText: React.ReactNode = 'Publish';
    if (publishedThisSession) {
        publishButtonText = (
            <>
                <i className={'icon icon-check'}/>
                {'Published'}
            </>
        );
    } else if (props.playbookRun.retrospective_published_at && !props.playbookRun.retrospective_was_canceled) {
        publishButtonText = 'Republish';
    }

    return (
        <ReportContainer>
            <Header>
                <Title>{'Report'}</Title>
                <HeaderButtonsRight>
                    <CustomPrimaryButton
                        onClick={publishPressed}
                    >
                        <TextContainer>{publishButtonText}</TextContainer>
                    </CustomPrimaryButton>
                    <EditButton
                        editing={editing}
                        onSave={savePressed}
                        onEdit={() => setEditing(true)}
                    />
                </HeaderButtonsRight>
            </Header>
            {editing &&
                <ReportTextarea
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
    justify-content: center;
    width: 65px;
    flex-grow: 1;
`;

const EditButton = (props: SaveButtonProps) => {
    if (props.editing) {
        return (
            <SecondaryButtonSmaller
                onClick={props.onSave}
            >
                <TextContainer>
                    <i className={'fa fa-floppy-o'}/>
                    {'Save'}
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
                {'Edit'}
            </TextContainer>
        </SecondaryButtonSmaller>
    );
};

export default Report;
