import React from 'react';
import {Redirect} from 'react-router-dom';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import PlaybookEdit from 'src/components/backstage/playbook_edit/playbook_edit';
import {pluginUrl} from 'src/browser_routing';
import {displayPlaybookCreateModal} from 'src/actions';
import {PrimaryButton} from '../assets/buttons';

export const NewPlaybook = () => {
    const searchParams = Object.fromEntries(new URLSearchParams(location.search));

    if (!searchParams.teamId) {
        return <Redirect to={pluginUrl('/playbooks')}/>;
    }

    return (
        <PlaybookEdit
            teamId={searchParams.teamId}
            name={searchParams.name}
            template={searchParams.template}
            description={searchParams.description}
            public={searchParams.public !== 'false'}
            isNew={true}
        />
    );
};

export const PlaybookModalButton = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    return (
        <CreatePlaybookButton
            onClick={() => dispatch(displayPlaybookCreateModal({}))}
        >
            <i className='icon-plus mr-2'/>
            {formatMessage({defaultMessage: 'Create playbook'})}
        </CreatePlaybookButton>
    );
};

const CreatePlaybookButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
`;
