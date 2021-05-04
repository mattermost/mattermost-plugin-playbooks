import React, {FC} from 'react';
import {Redirect} from 'react-router-dom';

import {Team} from 'mattermost-redux/types/teams';

import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {useAllowPlaybookCreationInCurrentTeam} from 'src/hooks';
import {teamPluginUrl} from 'src/browser_routing';

interface Props {
    currentTeam: Team
    onClose: () => void
}

export const NewPlaybook: FC<Props> = (props: Props) => {
    const allowPlaybookCreation = useAllowPlaybookCreationInCurrentTeam();

    if (!allowPlaybookCreation) {
        return <Redirect to={teamPluginUrl(props.currentTeam.name, '/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            currentTeam={props.currentTeam}
            onClose={props.onClose}
            isNew={true}
        />
    );
};
