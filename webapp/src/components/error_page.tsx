
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {useSelector} from 'react-redux';

import qs from 'qs';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import WarningIcon from 'src/components/assets/icons/warning_icon';
import {ErrorPageTypes} from 'src/constants';
import {teamPluginUrl} from 'src/browser_routing';

const ErrorPage = () => {
    useEffect(() => {
        document.body.setAttribute('class', 'sticky error');
        return () => {
            document.body.removeAttribute('class');
        };
    }, []);

    const queryString = useLocation().search.substr(1);
    const params = qs.parse(queryString);

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    let title = 'Page not found';
    let message = 'The page you were trying to reach does not exist.';
    let returnTo = '/';
    let returnToMsg = 'Back to Mattermost';

    switch (params.type) {
    case ErrorPageTypes.PLAYBOOK_RUNS:
        title = 'Run not found';
        message = "The run you're requesting is private or does not exist.";
        returnTo = teamPluginUrl(currentTeam.name, '/runs');
        returnToMsg = 'Back to runs';
        break;
    case ErrorPageTypes.PLAYBOOKS:
        title = 'Playbook Not Found';
        message = "The playbook you're requesting is private or does not exist.";
        returnTo = teamPluginUrl(currentTeam.name, '/playbooks');
        returnToMsg = 'Back to playbooks';
        break;
    }

    return (
        <div className='container-fluid'>
            <div className='error__container'>
                <div className='error__icon'>
                    <WarningIcon/>
                </div>
                <h2>
                    {title}
                </h2>
                <p>
                    {message}
                </p>
                <Link to={returnTo}>
                    {returnToMsg}
                </Link>
            </div>
        </div>
    );
};

export default ErrorPage;
