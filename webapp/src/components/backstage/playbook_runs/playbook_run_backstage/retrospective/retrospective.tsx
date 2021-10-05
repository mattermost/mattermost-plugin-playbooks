// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import UpgradeRetrospectiveSvg from 'src/components/assets/upgrade_retrospective_svg';
import {Container, Left, Right} from 'src/components/backstage/playbook_runs/shared';
import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';

import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookRun} from 'src/types/playbook_run';

import Report from './report';
import TimelineRetro from './timeline_retro';

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
}

export const Retrospective = (props: Props) => {
    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();

    if (!allowRetrospectiveAccess) {
        return (
            <UpgradeBanner
                background={<UpgradeRetrospectiveSvg/>}
                titleText={'Publish retrospective report and access the timeline'}
                helpText={'Celebrate success and learn from mistakes with retrospective reports. Filter timeline events for process review, stakeholder engagement, and auditing purposes.'}
                notificationType={AdminNotificationType.RETROSPECTIVE}
                verticalAdjustment={650}
            />
        );
    }

    return (
        <Container>
            <Left>
                <Report playbookRun={props.playbookRun}/>
            </Left>
            <Right>
                <TimelineRetro
                    playbookRun={props.playbookRun}
                    deleteTimelineEvent={props.deleteTimelineEvent}
                />
            </Right>
        </Container>
    );
};
