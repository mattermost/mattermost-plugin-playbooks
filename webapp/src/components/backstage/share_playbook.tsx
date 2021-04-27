import React, {FC} from 'react';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {Playbook} from 'src/types/playbook';

import SelectUsersBelow from './select_users_below';

export interface SharePlaybookProps {
    onAddUser: (userid: string) => void;
    onRemoveUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    playbook: Playbook;
}

const SharePlaybook: FC<SharePlaybookProps> = (props: SharePlaybookProps) => {
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
