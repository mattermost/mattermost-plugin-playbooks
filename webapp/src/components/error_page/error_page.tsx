
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import qs from 'qs';

import React from 'react';
import {Link, RouteComponentProps} from 'react-router-dom';

import WarningIcon from 'src/components/assets/icons/warning_icon';
import {ErrorPageTypes} from 'src/utils/constants';
import {teamPluginUrl} from 'src/utils/utils';

interface Props extends RouteComponentProps {
    teamName: String,
}

export default class ErrorPage extends React.PureComponent<Props> {
    public componentDidMount() {
        document.body.setAttribute('class', 'sticky error');
    }

    public componentWillUnmount() {
        document.body.removeAttribute('class');
    }

    public render() {
        const queryString = this.props.location.search.substr(1);
        const params = qs.parse(queryString);

        let title = 'Page Not Found';
        let message = 'The page you were trying to reach does not exist';
        let returnTo = '/';
        let returnToMsg = 'Back to Mattermost';

        switch (params.type) {
        case ErrorPageTypes.INCIDENTS:
            title = 'Incident Not Found';
            message = "The incident you're requesting is private or does not exist. Please contact an Administrator to be added to the incident.";
            returnTo = teamPluginUrl(this.props.teamName, '/incidents');
            returnToMsg = 'Back to Incidents';
            break;
        case ErrorPageTypes.PLAYBOOKS:
            title = 'Playbook Not Found';
            message = "The playbook you're requesting is private or does not exist. Please contact an Administrator to access the playbook.";
            returnTo = teamPluginUrl(this.props.teamName, '/playbooks');
            returnToMsg = 'Back to Playbooks';
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
    }
}
