// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import classNames from 'classnames';

import BackstageIncidentList from 'src/components/backstage/incidents/incident_list';
import PlaybookList from 'src/components/backstage/playbook/playbook_list';

import {BackstageArea} from 'src/types/backstage';

import './backstage.scss';
import Waves from '../assets/waves';

interface Props {
    onBack: () => void;
    selectedArea: BackstageArea;
    currentTeamId: string;
    currentTeamName: string;
    setSelectedArea: (area: BackstageArea) => void;
    theme: Record<string, string>;
}

const Backstage = ({onBack, selectedArea, setSelectedArea, currentTeamId, currentTeamName}: Props): React.ReactElement<Props> => {
    let activeArea = <PlaybookList/>;
    if (selectedArea === BackstageArea.Incidents) {
        activeArea = (
            <BackstageIncidentList
                currentTeamId={currentTeamId}
                currentTeamName={currentTeamName}
            />
        );
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
                        onClick={() => setSelectedArea(BackstageArea.Incidents)}
                    >
                        {'Incidents'}
                    </div>
                    <div
                        className={classNames('menu-title', {active: selectedArea === BackstageArea.Playbooks})}
                        onClick={() => setSelectedArea(BackstageArea.Playbooks)}
                    >
                        {'Playbooks'}
                    </div>
                </div>
            </div>
            <div className='content-container'>
                {activeArea}
            </div>
            <Waves/>
        </div>
    );
};

export default Backstage;
