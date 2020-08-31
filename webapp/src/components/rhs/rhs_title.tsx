// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';

import {useCurrentIncident} from 'src/hooks';

import './rhs_title.scss';

const RHSTitle: FC = () => {
    const [incident] = useCurrentIncident();

    return (
        <div className='rhs-incident-title'>
            {(incident && incident.name) || 'Incidents'}
        </div>
    );
};

export default RHSTitle;
