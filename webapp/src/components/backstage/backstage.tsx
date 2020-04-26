// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {BackstageArea} from 'src/types/backstage';
import PlaybookList from 'src/components/playbook/playbook_list';

import BackIcon from './back_icon';
import './backstage.scss';

interface Props {
    onBack: () => void;
    selectedArea: BackstageArea;
}

const Backstage = ({onBack, selectedArea}: Props): React.ReactElement => {
    return (
        <div className='Backstage'>
            <div className='sidebar'>
                <div className='header'>
                    <BackIcon
                        className='back-icon'
                        onClick={onBack}
                    />
                    {'Back to Mattermost'}
                </div>
                <div className='menu'>
                    <div className={'menu-title ' + (selectedArea === BackstageArea.Dashboard ? 'active' : 'inactive')} >
                        {'Dashboard'}
                    </div>
                    <div className={'menu-title ' + (selectedArea === BackstageArea.Incidents ? 'active' : 'inactive')} >
                        {'Incidents'}
                    </div>
                    <div className={'menu-title ' + (selectedArea === BackstageArea.Playbooks ? 'active' : 'inactive')} >
                        {'Playbooks'}
                    </div>
                </div>
            </div>
            <div className='content-container'>
                { selectedArea === BackstageArea.Playbooks &&
                    <PlaybookList/> }

            </div>
        </div>
    );
};

export default Backstage;
