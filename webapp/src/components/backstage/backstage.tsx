// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Switch, Route, NavLink, useRouteMatch, Redirect} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import Icon from '@mdi/react';
import {mdiThumbsUpDown, mdiClipboardPlayMultipleOutline} from '@mdi/js';

import {GlobalState} from 'mattermost-redux/types/store';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {Theme} from 'mattermost-redux/types/themes';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import Playbook from 'src/components/backstage/playbooks/playbook';
import {promptForFeedback} from 'src/client';
import PlaybookRunBackstage
    from 'src/components/backstage/playbook_runs/playbook_run_backstage/playbook_run_backstage';
import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook_edit';
import {NewPlaybook} from 'src/components/backstage/new_playbook';
import {ErrorPageTypes} from 'src/constants';
import {pluginErrorUrl} from 'src/browser_routing';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import {useForceDocumentTitle} from 'src/hooks';
import CloudModal from 'src/components/cloud_modal';
import ErrorPage from 'src/components/error_page';
import SettingsView from 'src/components/backstage/settings';
import {BackstageNavbar} from 'src/components/backstage/backstage_navbar';
import RunsPage from 'src/components/backstage/runs_page';
import {applyTheme} from 'src/components/backstage/css_utils';

const BackstageContainer = styled.div`
    background: var(--center-channel-bg);
    // The container should take up all vertical real estate, less the height of the global header.
    height: calc(100% - 40px);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
`;

const BackstageTitlebarItem = styled(NavLink)`
    && {
        font-size: 16px;
        cursor: pointer;
        color: var(--center-channel-color);
        fill: var(--center-channel-color);
        padding: 0 8px;
        margin-right: 39px;
        display: flex;
        align-items: center;

        &:hover {
            text-decoration: unset;
            color: var(--button-bg);
            fill: var(--button-bg);
        }

        &.active {
            color: var(--button-bg);
            fill: var(--button-bg);
            text-decoration: unset;
        }

        & > :first-child {
            margin-right: 12px;
        }
    }
`;

const BackstageBody = styled.div`
    z-index: 1;
    flex-grow: 1;
`;

const Backstage = () => {
    const {formatMessage} = useIntl();

    //@ts-ignore plugins state is a thing
    const npsAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.nps']));
    const currentTheme = useSelector<GlobalState, Theme>(getTheme);
    useEffect(() => {
        // This class, critical for all the styling to work, is added by ChannelController,
        // which is not loaded when rendering this root component.
        document.body.classList.add('app__body');
        const root = document.getElementById('root');
        if (root) {
            root.className += ' channel-view';
        }

        applyTheme(currentTheme);
        return function cleanUp() {
            document.body.classList.remove('app__body');
        };
    }, [currentTheme]);

    useForceDocumentTitle('Playbooks');

    const teams = useSelector<GlobalState, Team[]>(getMyTeams);

    const match = useRouteMatch();

    return (
        <BackstageContainer>
            <Switch>
                <Route path={`${match.url}/error`}/>
                <Route>
                    <BackstageNavbar className='flex justify-content-between'>
                        <div className='d-flex items-center'>
                            <BackstageTitlebarItem
                                to={`${match.url}/runs`}
                                activeClassName={'active'}
                                data-testid='playbookRunsLHSButton'
                            >
                                <Icon
                                    path={mdiClipboardPlayMultipleOutline}
                                    title='Runs'
                                    size={1.4}
                                />
                                {'Runs'}
                            </BackstageTitlebarItem>
                            <BackstageTitlebarItem
                                to={`${match.url}/playbooks`}
                                activeClassName={'active'}
                                data-testid='playbooksLHSButton'
                            >
                                <PlaybookIcon/>
                                {'Playbooks'}
                            </BackstageTitlebarItem>
                            <BackstageTitlebarItem
                                to={`${match.url}/settings`}
                                activeClassName={'active'}
                                data-testid='settingsLHSButton'
                            >
                                <div className={'fa fa-gear'}/>
                                {formatMessage({defaultMessage: 'Settings'})}
                            </BackstageTitlebarItem>
                        </div>
                        <div className='d-flex items-center'>
                            {npsAvailable &&
                                <BackstageTitlebarItem
                                    onClick={promptForFeedback}
                                    to={`/${teams[0].name}/messages/@surveybot`}
                                    data-testid='giveFeedbackButton'
                                >
                                    <Icon
                                        path={mdiThumbsUpDown}
                                        title='Give Feedback'
                                        size={1}
                                    />
                                    {'Give Feedback'}
                                </BackstageTitlebarItem>
                            }
                        </div>
                    </BackstageNavbar>
                </Route>
            </Switch>
            <BackstageBody>
                <Switch>
                    <Route path={`${match.url}/playbooks/new`}>
                        <NewPlaybook/>
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId/edit/:tabId?`}>
                        <PlaybookEdit
                            isNew={false}
                        />
                    </Route>
                    <Route path={`${match.url}/playbooks/:playbookId`}>
                        <Playbook/>
                    </Route>
                    <Route path={`${match.url}/playbooks`}>
                        <PlaybookList/>
                    </Route>
                    <Redirect
                        from={`${match.url}/incidents/:playbookRunId`}
                        to={`${match.url}/runs/:playbookRunId`}
                    />
                    <Route path={`${match.url}/runs/:playbookRunId`}>
                        <PlaybookRunBackstage/>
                    </Route>
                    <Redirect
                        from={`${match.url}/incidents`}
                        to={`${match.url}/runs`}
                    />
                    <Route path={`${match.url}/runs`}>
                        <RunsPage/>
                    </Route>
                    <Route path={`${match.url}/settings`}>
                        <SettingsView/>
                    </Route>
                    <Route path={`${match.url}/error`}>
                        <ErrorPage/>
                    </Route>
                    <Route
                        exact={true}
                        path={`${match.url}/`}
                    >
                        <Redirect to={`${match.url}/runs`}/>
                    </Route>
                    <Route>
                        <Redirect to={pluginErrorUrl(ErrorPageTypes.DEFAULT)}/>
                    </Route>
                </Switch>
            </BackstageBody>
            <CloudModal/>
        </BackstageContainer>
    );
};

export default Backstage;
