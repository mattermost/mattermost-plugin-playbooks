// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PlaybookList from 'src/components/playbook/playbook_list';

import BackIcon from './back_icon';
import './backstage.scss';

interface Props {
    show: boolean;
    children: React.ReactElement;
    onBack: () => void;
}

const Backstage = ({onBack}: Props): React.ReactElement => {
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
                    <div className='menu-title inactive'>
                        {'Dashboard'}
                    </div>
                    <div className='menu-title inactive'>
                        {'Incidents'}
                    </div>
                    <div className='menu-title inactive'>
                        {'Services'}
                    </div>
                    <div className='menu-title active'>
                        {'Playbooks'}
                    </div>
                </div>
            </div>
            <div className='content-container'>
                <PlaybookList/>
            </div>
        </div>
    );
};

export default Backstage;
