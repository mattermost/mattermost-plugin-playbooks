// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {ActionFunc} from 'mattermost-redux/types/actions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import {BackstageSubheader, BackstageSubheaderDescription, TabContainer} from 'src/components/backstage/styles';
import SharePlaybook from 'src/components/backstage/share_playbook';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    setPlaybook: (playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist) => void;
    setChangesMade: (b: boolean) => void;
    searchUsers: (term: string) => ActionFunc;
    getUsers: () => ActionFunc;
    teamId?: string;
}

const RetrospectiveEdit = ({playbook, setPlaybook, setChangesMade, searchUsers, getUsers, teamId}: Props) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlaybook({
            ...playbook,
            create_public_playbook_run: e.target.value === 'public',
        });
        setChangesMade(true);
    };

    const handleUsersInput = (userId: string) => {
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids, userId],
        });
        setChangesMade(true);
    };

    const handleRemoveUser = (userId: string) => {
        const idx = playbook.member_ids.indexOf(userId);
        setPlaybook({
            ...playbook,
            member_ids: [...playbook.member_ids.slice(0, idx), ...playbook.member_ids.slice(idx + 1)],
        });
        setChangesMade(true);
    };

    const handleClearUsers = () => {
        setPlaybook({
            ...playbook,
            member_ids: [],
        });
        setChangesMade(true);
    };

    return (
        <TabContainer>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Channel access'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Determine the type of channel this playbook creates.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <RadioContainer>
                    <RadioLabel>
                        <RadioInput
                            type='radio'
                            name='public'
                            value={'public'}
                            checked={playbook.create_public_playbook_run}
                            onChange={handlePublicChange}
                        />
                        {formatMessage({defaultMessage: 'Public'})}
                    </RadioLabel>
                    <RadioLabel>
                        <RadioInput
                            type='radio'
                            name='public'
                            value={'private'}
                            checked={!playbook.create_public_playbook_run}
                            onChange={handlePublicChange}
                        />
                        {formatMessage({defaultMessage: 'Private'})}
                    </RadioLabel>
                </RadioContainer>
            </SidebarBlock>
            <SidebarBlock>
                <SharePlaybook
                    currentUserId={currentUserId}
                    onAddUser={handleUsersInput}
                    onRemoveUser={handleRemoveUser}
                    searchProfiles={searchUsers}
                    getProfiles={getUsers}
                    memberIds={playbook.member_ids}
                    onClear={handleClearUsers}
                    teamId={teamId || playbook.team_id}
                />
            </SidebarBlock>
        </TabContainer>
    );
};

const RadioContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const RadioLabel = styled.label`
    && {
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: normal;
        line-height: 20px;
    }
`;

const RadioInput = styled.input`
    && {
        width: 16px;
        height: 16px;
        margin: 0 8px 0 0;
    }
`;

export default RetrospectiveEdit;
