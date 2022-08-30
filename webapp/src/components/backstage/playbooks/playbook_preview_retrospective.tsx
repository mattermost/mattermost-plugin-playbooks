// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Duration} from 'luxon';

import FormattedMarkdown from 'src/components/formatted_markdown';
import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookWithChecklist} from 'src/types/playbook';

import {TextBadge} from 'src/components/backstage/playbooks/playbook_preview_badges';
import {Card, CardEntry, CardSubEntry} from 'src/components/backstage/playbooks/playbook_preview_cards';
import Section from 'src/components/backstage/playbooks/playbook_preview_section';
import {formatDuration} from 'src/components/formatted_duration';

interface Props {
    id: string;
    playbook: PlaybookWithChecklist;
}

const PlaybookPreviewRetrospective = (props: Props) => {
    const {formatMessage} = useIntl();
    const retrospectiveAccess = useAllowRetrospectiveAccess();

    if (!retrospectiveAccess || !props.playbook.retrospective_enabled) {
        return null;
    }

    return (
        <Section
            id={props.id}
            title={formatMessage({defaultMessage: 'Retrospective'})}
        >
            <Card>
                <CardEntry
                    title={formatMessage(
                        {defaultMessage: 'The channel will be reminded to perform the retrospective {reminderEnabled, select, true {every} other {}}'},
                        {reminderEnabled: props.playbook.retrospective_reminder_interval_seconds !== 0}
                    )}
                    iconName={'lightbulb-outline'}
                    extraInfo={(
                        <TextBadge>
                            {props.playbook.retrospective_reminder_interval_seconds === 0 ? 'ONCE' : formatDuration(Duration.fromObject({seconds: props.playbook.retrospective_reminder_interval_seconds}), 'long')}
                        </TextBadge>
                    )}
                    enabled={true}
                >
                    <CardSubEntry
                        title={formatMessage({
                            defaultMessage:
                                'Retrospective report template',
                        })}
                        enabled={props.playbook.retrospective_template !== ''}
                    >
                        <FormattedMarkdown value={props.playbook.retrospective_template}/>
                    </CardSubEntry>
                </CardEntry>
            </Card>
        </Section>
    );
};

export default PlaybookPreviewRetrospective;
