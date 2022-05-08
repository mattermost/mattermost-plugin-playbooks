// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
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
import PlaybookEdit from 'src/components/backstage/playbook_edit/playbook_edit';
import PlaybookEditor from 'src/components/backstage/playbook_editor/playbook_editor';
import {NewPlaybook} from 'src/components/backstage/new_playbook';
import {ErrorPageTypes} from 'src/constants';
import {pluginErrorUrl} from 'src/browser_routing';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import {useForceDocumentTitle} from 'src/hooks';
import CloudModal from 'src/components/cloud_modal';
import ErrorPage from 'src/components/error_page';
import {BackstageNavbar} from 'src/components/backstage/backstage_navbar';
import RunsPage from 'src/components/backstage/runs_page';
import {applyTheme} from 'src/components/backstage/css_utils';

import {ToastProvider} from './toast_banner';

const BackstageContainer = styled.div`
    background: var(--center-channel-bg);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    height: 100%;
`;

const BackstageTitlebarItem = styled(NavLink)`
    && {
        font-size: 16px;
        cursor: pointer;
        color: rgba(var(--center-channel-color-rgb), 0.80);
        fill: rgba(var(--center-channel-color-rgb), 0.80);
        padding: 0 12px;
        margin-right: 20px;
        display: flex;
        align-items: center;
        height: 40px;
        border-radius: 4px;
        border: 0px;

        &:hover {
            text-decoration: unset;
            color: rgba(var(--center-channel-color-rgb), 0.80);
            fill: rgba(var(--center-channel-color-rgb), 0.80);
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }

        &.active {
            color: var(--button-bg);
            fill: var(--button-bg);
            text-decoration: unset;
            background: rgba(var(--button-bg-rgb), 0.08);
        }

        & > :first-child {
            margin-right: 12px;
        }
    }
`;

const BackstageBody = styled.div`
    z-index: 1;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
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
        <BackstageContainer
            id={BackstageID}
        >
            <ToastProvider>
                <Switch>
                    <Route path={`${match.url}/error`}/>
                    <Route path={`${match.url}/start`}/>
                    <Route path={`${match.url}/playbooks/:playbookId/editor`}/>
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
                                        title={formatMessage({defaultMessage: 'Runs'})}
                                        size={1.4}
                                    />
                                    {formatMessage({defaultMessage: 'Runs'})}
                                </BackstageTitlebarItem>
                                <BackstageTitlebarItem
                                    to={`${match.url}/playbooks`}
                                    activeClassName={'active'}
                                    data-testid='playbooksLHSButton'
                                >
                                    <PlaybookIcon/>
                                    {formatMessage({defaultMessage: 'Playbooks'})}
                                </BackstageTitlebarItem>
                            </div>
                            <div className='d-flex items-center'>
                                {npsAvailable && (
                                    <BackstageTitlebarItem
                                        onClick={promptForFeedback}
                                        to={`/${teams[0].name}/messages/@surveybot`}
                                        data-testid='giveFeedbackButton'
                                    >
                                        <Icon
                                            path={mdiThumbsUpDown}
                                            title={formatMessage({defaultMessage: 'Give Feedback'})}
                                            size={1}
                                        />
                                        {formatMessage({defaultMessage: 'Give Feedback'})}
                                    </BackstageTitlebarItem>
                                )}
                            </div>
                        </BackstageNavbar>
                    </Route>
                </Switch>
                <BackstageBody>
                    <Switch>
                        <Route path={`${match.url}/playbooks/new`}>
                            <NewPlaybook/>
                        </Route>
                        <Route
                            path={`${match.url}/playbooks/:playbookId/editor`}
                        >
                            <PlaybookEditor/>
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
                        <Route path={`${match.url}/error`}>
                            <ErrorPage/>
                        </Route>
                        <Route
                            path={`${match.url}/start`}
                        >
                            <PlaybookList firstTimeUserExperience={true}/>
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
            </ToastProvider>
        </BackstageContainer>
    );
};

export const BackstageID = 'playbooks-backstageRoot';

export default Backstage;
