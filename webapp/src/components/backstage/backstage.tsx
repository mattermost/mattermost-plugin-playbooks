// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Switch, Route, NavLink, useRouteMatch} from 'react-router-dom';

import BackstageIncidentList from 'src/components/backstage/incidents/incident_list';
import PlaybookList from 'src/components/backstage/playbook/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook/playbook_edit';

import {navigateToUrl, navigateToTeamPluginUrl} from 'src/utils/utils';

import './backstage.scss';
import Waves from '../assets/waves';

interface Props {
    currentTeamId: string;
    currentTeamName: string;
    currentTeamDisplayName: string;
    theme: Record<string, string>;
}

export const Backstage = (props: Props): React.ReactElement<Props> => {
    useEffect(() => {
        // This class, critical for all the styling to work, is added by ChannelController,
        // which is not loaded when rendering this root component.
        document.body.classList.add('app__body');

        return function cleanUp() {
            document.body.classList.remove('app__body');
        };
    }, []);

    const match = useRouteMatch();

    const goToMattermost = () => {
        navigateToUrl(`/${props.currentTeamName}`);
    };

    const goToPlaybooks = () => {
        navigateToTeamPluginUrl(props.currentTeamName, '/playbooks');
    };

    return (
        <div className='Backstage'>
            <div className='Backstage__sidebar'>
                <div className='Backstage__sidebar__header'>
                    <div
                        className='cursor--pointer'
                        onClick={goToMattermost}
                    >
                        <i className='icon-arrow-left mr-2 back-icon'/>
                        {'Back to Mattermost'}
                    </div>
                </div>
                <div className='menu'>
                    <NavLink
                        data-testid='incidentsLHSButton'
                        to={`${match.url}/incidents`}
                        className={'menu-title'}
                        activeClassName={'active'}
                    >
                        {'Incidents'}
                    </NavLink>
                    <NavLink
                        data-testid='playbooksLHSButton'
                        to={`${match.url}/playbooks`}
                        className={'menu-title'}
                        activeClassName={'active'}
                    >
                        {'Playbooks'}
                    </NavLink>
                </div>
            </div>
            <div className='content-container'>
                <Switch>
                    <Route path={`${match.url}/playbooks/new`}>
                        <PlaybookEdit
                            newPlaybook={true}
                            currentTeamID={props.currentTeamId}
                            onClose={goToPlaybooks}
                        />
                    </Route>
                    <Route
                        path={`${match.url}/playbooks/:playbookId`}
                        render={(playbookEditRenderProps) => (
                            <PlaybookEdit
                                playbookId={playbookEditRenderProps.match.params.playbookId}
                                newPlaybook={false}
                                currentTeamID={props.currentTeamId}
                                onClose={goToPlaybooks}
                            />
                        )}
                    />
                    <Route path={`${match.url}/playbooks`}>
                        <PlaybookList/>
                    </Route>
                    <Route path={`${match.url}/incidents`}>
                        <BackstageIncidentList
                            currentTeamId={props.currentTeamId}
                            currentTeamName={props.currentTeamName}
                            currentTeamDisplayName={props.currentTeamDisplayName}
                        />
                    </Route>
                </Switch>
            </div>
            <Waves/>
        </div>
    );
};
