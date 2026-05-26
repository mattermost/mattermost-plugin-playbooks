// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';
import {SettingsOutlineIcon} from '@mattermost/compass-icons/components';

import {Section, SectionTitle} from 'src/components/backstage/playbook_edit/styles';

import AdminOnlyEditToggle from 'src/components/backstage/playbook_editor/admin_only_edit_toggle';

interface Props {
    isChecked: boolean;
    onChange: (value: boolean) => void;
}

const SectionAdminSettings = ({isChecked, onChange}: Props) => {
    return (
        <StyledSection data-testid='admin-only-edit-toggle'>
            <StyledSectionTitle>
                <SettingsOutlineIcon size={22}/>
                <FormattedMessage defaultMessage='Settings'/>
            </StyledSectionTitle>
            <Setting>
                <AdminOnlyEditToggle
                    isChecked={isChecked}
                    onChange={onChange}
                />
            </Setting>
        </StyledSection>
    );
};

export default SectionAdminSettings;

const StyledSection = styled(Section)`
    padding: 2rem;
    padding-bottom: 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    margin: 0;
    margin-bottom: 20px;
`;

const StyledSectionTitle = styled(SectionTitle)`
    display: flex;
    align-items: center;
    margin: 0 0 24px;
    font-size: 16px;
    font-weight: 600;
    gap: 8px;

    svg {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const Setting = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 24px;
    gap: 8px;
`;
