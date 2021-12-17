// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {BackstageGroupToggleHeader, SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    StyledMarkdownTextbox,
    StyledSelect,
    TabContainer,
} from 'src/components/backstage/styles';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
] as const;

interface Props {
    playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist;
    retrospectiveAccess: boolean;
    setPlaybook: (playbook: DraftPlaybookWithChecklist | PlaybookWithChecklist) => void;
    setChangesMade: (b: boolean) => void;
}

const RetrospectiveEdit = ({
    playbook,
    retrospectiveAccess,
    setPlaybook,
    setChangesMade,
}: Props) => {
    const {formatMessage} = useIntl();

    if (!retrospectiveAccess) {
        return (
            <TabContainer>
                {'Upgrade required for access to retrospective features.'}
            </TabContainer>
        );
    }

    return (
        <TabContainer>
            <SidebarBlock>
                <BackstageGroupToggleHeader id={'retrospective-enabled'}>
                    <Toggle
                        isChecked={playbook.retrospective_enabled}
                        onChange={() => {
                            setPlaybook({
                                ...playbook,
                                retrospective_enabled: !playbook.retrospective_enabled,
                            });
                            setChangesMade(true);
                        }}
                    />
                    {formatMessage({defaultMessage: 'Enable retrospective'})}
                </BackstageGroupToggleHeader>
            </SidebarBlock>

            <SidebarBlock id={'retrospective-reminder-interval'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective reminder interval'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Reminds the channel at a specified interval to fill out the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledSelect
                    value={retrospectiveReminderOptions.find((option) => option.value === playbook.retrospective_reminder_interval_seconds)}
                    onChange={(option: { label: string, value: number }) => {
                        setPlaybook({
                            ...playbook,
                            retrospective_reminder_interval_seconds: option ? option.value : option,
                        });
                        setChangesMade(true);
                    }}
                    options={retrospectiveReminderOptions}
                    isClearable={false}
                    isDisabled={!playbook.retrospective_enabled}
                />
            </SidebarBlock>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective template'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Default text for the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledMarkdownTextbox
                    className={'playbook_retrospective_template'}
                    id={'playbook_retrospective_template_edit'}
                    placeholder={formatMessage({defaultMessage: 'Enter retrospective template'})}
                    value={playbook.retrospective_template}
                    setValue={(value: string) => {
                        setPlaybook({
                            ...playbook,
                            retrospective_template: value,
                        });
                        setChangesMade(true);
                    }}
                    disabled={!playbook.retrospective_enabled}
                />
            </SidebarBlock>
        </TabContainer>
    );
};

export default RetrospectiveEdit;
