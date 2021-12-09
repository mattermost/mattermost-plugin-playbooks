// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {
    BackstageSubheader,
    BackstageSubheaderDescription,
    StyledMarkdownTextbox,
    StyledSelect,
    TabContainer,
} from 'src/components/backstage/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import DefaultUpdateTimer from 'src/components/backstage/default_update_timer';
import {
    BackstageGroupToggleHeader,
    Section,
    SectionTitle,
    Setting,
    SidebarBlock,
} from 'src/components/backstage/playbook_edit/styles';
import {DraftPlaybookWithChecklist, PlaybookWithChecklist} from 'src/types/playbook';
import {InputKeywords} from 'src/components/backstage/playbook_edit/automation/input_keywords';

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

const StatusUpdatesEdit = ({playbook, setPlaybook, setChangesMade, retrospectiveAccess}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <TabContainer>
            <SidebarBlock>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Run Summary'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'This template helps to standardize the format for a concise description that explains each run to its stakeholders.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledMarkdownTextbox
                    className={'playbook_description'}
                    id={'playbook_description_edit'}
                    placeholder={formatMessage({defaultMessage: 'Use Markdown to create a template.'})}
                    value={playbook.run_summary_template}
                    setValue={(run_summary_template: string) => {
                        setPlaybook({
                            ...playbook,
                            run_summary_template,
                        });
                        setChangesMade(true);
                    }}
                />
            </SidebarBlock>
            <SidebarBlock>
                <BackstageGroupToggleHeader id={'status-updates'}>
                    <Toggle
                        isChecked={playbook.status_update_enabled}
                        onChange={() => {
                            setPlaybook({
                                ...playbook,
                                status_update_enabled: !playbook.status_update_enabled,
                                webhook_on_status_update_enabled: playbook.webhook_on_status_update_enabled && !playbook.status_update_enabled,
                                broadcast_enabled: playbook.broadcast_enabled && !playbook.status_update_enabled,
                            });
                            setChangesMade(true);
                        }}
                    />
                    {formatMessage({defaultMessage: 'Enable status updates'})}
                </BackstageGroupToggleHeader>
            </SidebarBlock>
            <SidebarBlock id={'default-update-timer'}>
                <DefaultUpdateTimer
                    seconds={playbook.reminder_timer_default_seconds}
                    setSeconds={(seconds: number) => {
                        if (seconds !== playbook.reminder_timer_default_seconds &&
                            seconds > 0) {
                            setPlaybook({
                                ...playbook,
                                reminder_timer_default_seconds: seconds,
                            });
                        }
                    }}
                    disabled={!playbook.status_update_enabled}
                />
            </SidebarBlock>
            <SidebarBlock id={'status-update-text'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Status updates'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'This template helps to standardize the format for recurring updates that take place throughout each run to keep.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledMarkdownTextbox
                    className={'playbook_reminder_message'}
                    id={'playbook_reminder_message_edit'}
                    placeholder={formatMessage({defaultMessage: 'Use Markdown to create a template.'})}
                    value={playbook.reminder_message_template}
                    setValue={(value: string) => {
                        setPlaybook({
                            ...playbook,
                            reminder_message_template: value,
                        });
                        setChangesMade(true);
                    }}
                    disabled={!playbook.status_update_enabled}
                />
            </SidebarBlock>
            {retrospectiveAccess &&
                <>
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
                </>
            }
        </TabContainer>
    );
};

export default StatusUpdatesEdit;
