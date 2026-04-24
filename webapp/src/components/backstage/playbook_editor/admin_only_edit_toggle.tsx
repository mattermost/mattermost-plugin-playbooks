// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {Playbook} from 'src/types/playbook';

type Props = {
    playbook: Playbook;
    onChange: (update: Partial<Playbook>) => void;
};

const AdminOnlyEditToggle = ({playbook, onChange}: Props) => {
    const intl = useIntl();

    return (
        <>
            <Toggle
                isChecked={playbook.admin_only_edit}
                onChange={() => onChange({admin_only_edit: !playbook.admin_only_edit})}
            >
                {intl.formatMessage({
                    defaultMessage: 'Only admins can edit this playbook',
                    id: 'playbooks.admin_only_edit_toggle.label',
                })}
            </Toggle>
            <HelpText>
                {intl.formatMessage({
                    defaultMessage: 'Members without admin role will have read-only access.',
                    id: 'playbooks.admin_only_edit_toggle.help_text',
                })}
            </HelpText>
        </>
    );
};

const HelpText = styled.p`
    color: var(--center-channel-color-56);
    font-size: 12px;
    margin: 4px 0 0 40px;
`;

export default AdminOnlyEditToggle;
