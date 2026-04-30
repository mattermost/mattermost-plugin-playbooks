// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

type Props = {
    isChecked: boolean;
    onChange: (value: boolean) => void;
};

const AdminOnlyEditToggle = ({isChecked, onChange}: Props) => {
    const intl = useIntl();

    return (
        <>
            <Toggle
                isChecked={isChecked}
                onChange={() => onChange(!isChecked)}
            >
                {intl.formatMessage({defaultMessage: 'Only admins can edit this playbook'})}
            </Toggle>
            <HelpText>
                {intl.formatMessage({defaultMessage: 'Members without admin role will have read-only access.'})}
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
