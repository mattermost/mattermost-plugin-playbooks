// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {useAllowRetrospectiveAccess} from 'src/hooks';

import {Card} from 'src/components/backstage/playbooks/playbook_preview_cards';
import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {Metric} from 'src/types/playbook';

import {SidebarBlock} from 'src/components/backstage/playbook_edit/styles';
import Metrics from 'src/components/backstage/playbook_edit/metrics/metrics';
import {BackstageSubheader, BackstageSubheaderDescription, StyledMarkdownTextbox, StyledSelect} from 'src/components/backstage/styles';

export interface EditingMetric {
    index: number;
    metric: Metric;
}

const retrospectiveReminderOptions = [
    {value: 0, label: 'Once'},
    {value: 3600, label: '1hr'},
    {value: 14400, label: '4hr'},
    {value: 86400, label: '24hr'},
    {value: 604800, label: '7days'},
] as const;

interface Props {
    playbook: Loaded<FullPlaybook>;
}

const SectionRetrospective = ({playbook}: Props) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();
    const [curEditingMetric, setCurEditingMetric] = useState<EditingMetric | null>(null);
    const updatePlaybook = useUpdatePlaybook(playbook.id);

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
                            retrospectiveReminderIntervalSeconds: option?.value,
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
                            retrospectiveTemplate: value,
                        });
                    }}
                    disabled={!playbook.retrospective_enabled}
                />
            </SidebarBlock>
        </Card>
    );
};

export default SectionRetrospective;
