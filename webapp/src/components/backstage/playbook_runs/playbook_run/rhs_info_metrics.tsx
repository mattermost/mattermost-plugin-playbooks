// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';

const RHSInfoMetrics = () => {
    const {formatMessage} = useIntl();

    return (
        <Section>
            <SectionHeader
                title={formatMessage({defaultMessage: 'Key Metrics'})}
                link={{
                    to: '#',
                    name: formatMessage({defaultMessage: 'View Retrospective'}),
                }}
            />
        </Section>
    );
};

export default RHSInfoMetrics;
