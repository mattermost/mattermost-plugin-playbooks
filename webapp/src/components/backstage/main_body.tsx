import React from 'react';
import {Switch, Route, useRouteMatch, Redirect} from 'react-router-dom';

import PlaybookRun from 'src/components/backstage/playbook_runs/playbook_run/playbook_run';

import Playbook from 'src/components/backstage/playbooks/playbook';

import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEdit from 'src/components/backstage/playbook_edit/playbook_edit';
import PlaybookEditor from 'src/components/backstage/playbook_editor/playbook_editor';
import {NewPlaybook} from 'src/components/backstage/new_playbook';
import {ErrorPageTypes} from 'src/constants';
import {pluginErrorUrl} from 'src/browser_routing';
import ErrorPage from 'src/components/error_page';
import RunsPage from 'src/components/backstage/runs_page';

const MainBody = () => {
    const match = useRouteMatch();
    return (
        <Switch>
            <Route path={`${match.url}/playbooks/new`}>
                <NewPlaybook/>
            </Route>
            <Route path={`${match.url}/playbooks/:playbookId/edit/:tabId?`}>
                <PlaybookEdit
                    isNew={false}
                />
            </Route>
            <Route path={`${match.url}/playbooks/:playbookId/preview`}>
                <Playbook/>
            </Route>
            <Route
                path={`${match.url}/playbooks/:playbookId`}
            >
                <PlaybookEditor/>
            </Route>
            <Route path={`${match.url}/playbooks`}>
                <PlaybookList/>
            </Route>
            <Redirect
                from={`${match.url}/incidents/:playbookRunId`}
                to={`${match.url}/runs/:playbookRunId`}
            />
            <Route path={`${match.url}/runs/:playbookRunId`}>
                <PlaybookRun/>
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
    );
};

export default MainBody;
