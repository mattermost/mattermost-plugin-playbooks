// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {useAllowRetrospectiveAccess} from 'src/hooks';
import {Metric} from 'src/types/playbook';

import {Card} from 'src/components/backstage/playbooks/playbook_preview_cards';
import {PlaybookReadWriteProps} from '../playbook_editor';
import {SidebarBlock} from '../../playbook_edit/styles';
import {BackstageSubheader, BackstageSubheaderDescription, StyledMarkdownTextbox, StyledSelect} from '../../styles';
import Metrics from '../../playbook_edit/metrics/metrics';

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
] as const;

export interface EditingMetric {
    index: number;
    metric: Metric;
}

const SectionRetrospective = ({playbook, updatePlaybook}: PlaybookReadWriteProps) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);

    if (!retrospectiveAccess) {
        return null;
    }

    return (
        <Card>
            <SidebarBlock id={'retrospective-reminder-interval'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Retrospective reminder interval'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Reminds the channel at a specified interval to fill out the retrospective.'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <StyledSelect
                    value={retrospectiveReminderOptions.find((option) => option.value === playbook.retrospective_reminder_interval_seconds)}
                    onChange={(option: {label: string; value: number;}) => {
                        updatePlaybook({
                            retrospective_reminder_interval_seconds: option?.value,
                        });
                    }}
                    options={retrospectiveReminderOptions}
                    isClearable={false}
                    isDisabled={!playbook.retrospective_enabled}
                />
            </SidebarBlock>
            <SidebarBlock id={'retrospective-metrics'}>
                <BackstageSubheader>
                    {formatMessage({defaultMessage: 'Key metrics'})}
                    <BackstageSubheaderDescription>
                        {formatMessage({defaultMessage: 'Configure custom metrics to fill out with the retrospective report'})}
                    </BackstageSubheaderDescription>
                </BackstageSubheader>
                <Metrics
                    playbook={playbook}
                    setPlaybook={updatePlaybook as any}
                    curEditingMetric={curEditingMetric}
                    setCurEditingMetric={setCurEditingMetric}
                    disabled={!playbook.retrospective_enabled}
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
                        updatePlaybook({
                            retrospective_template: value,
                        });
                    }}
                    disabled={!playbook.retrospective_enabled}
                />
            </SidebarBlock>
        </Card>
    );
};

export default SectionRetrospective;
