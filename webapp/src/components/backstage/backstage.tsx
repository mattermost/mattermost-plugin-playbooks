// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import classNames from 'classnames';

import IncidentList from 'src/components/backstage/incident_list/incident_list';
import PlaybookList from 'src/components/playbook/playbook_list';

import {BackstageArea} from 'src/types/backstage';

import './backstage.scss';

interface Props {
    onBack: () => void;
    selectedArea: BackstageArea;
    setSelectArea: (area: BackstageArea) => void;
}

const Backstage = ({onBack, selectedArea, setSelectArea}: Props): React.ReactElement => {
    let activeArea: React.ReactElement;
    switch (selectedArea) {
    case BackstageArea.Incidents:
        activeArea = <IncidentList/>;
        break;
    case BackstageArea.Playbooks:
    default:
        activeArea = <PlaybookList/>;
        break;
    }

    return (
        <div className='Backstage'>
            <div className='Backstage__sidebar'>
                <div className='Backstage__sidebar__header'>
                    <div
                        className='cursor--pointer'
                        onClick={onBack}
                    >
                        <i className='icon-arrow-left mr-2 back-icon'/>
                        {'Back to Mattermost'}
                    </div>
                </div>
                <div className='menu'>
                    {/*<div className={classNames('menu-title', {active: selectedArea === BackstageArea.Dashboard})}>
                        {'Dashboard'}
                    </div>*/}
                    <div
                        className={classNames('menu-title', {active: selectedArea === BackstageArea.Incidents})}
                        onClick={() => setSelectArea(BackstageArea.Incidents)}
                    >
                        {'Incidents'}
                    </div>
                    <div
                        className={classNames('menu-title', {active: selectedArea === BackstageArea.Playbooks})}
                        onClick={() => setSelectArea(BackstageArea.Playbooks)}
                    >
                        {'Playbooks'}
                    </div>
                </div>
            </div>
            <div className='content-container'>
                {activeArea}
            </div>
        </div>
    );
};

export default Backstage;
