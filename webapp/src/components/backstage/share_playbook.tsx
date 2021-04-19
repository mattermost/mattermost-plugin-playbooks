import React, {FC} from 'react';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {Playbook} from 'src/types/playbook';

import {Toggle} from './automation/toggle';
import {AutomationTitle, SelectorWrapper} from './automation/styles';
import SelectUsersBelow from './select_users_below';

export interface SharePlaybookProps {
    currentUserId: string;
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    onClear: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    playbook: Playbook;
}

const SharePlaybook: FC<SharePlaybookProps> = (props: SharePlaybookProps) => {
    const enabled = props.playbook.member_ids.length > 0;
    const toggle = () => {
        if (enabled) {
            props.onClear();
        } else {
            props.onAddUser(props.currentUserId);
        }
    };
    return (
        <SelectUsersBelow
            userIds={props.playbook.member_ids}
            onAddUser={props.onAddUser}
            onRemoveUser={props.onRemoveUser}
            searchProfiles={props.searchProfiles}
            getProfiles={props.getProfiles}
        />
    );
};

export default SharePlaybook;
