// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';

import './team_with_icon.scss';
import {Team} from 'mattermost-redux/types/teams';

import TeamIcon from './team_icon';

interface Props {
    team: Team;
    classNames?: Record<string, boolean>;
    className?: string;
    extra?: JSX.Element;
    withoutIcon?: boolean;
    withoutName?: boolean;
}

const TeamWithIcon = (props: Props) => {
    return (
        <div className={classNames('PlaybookRunTeamWithIcon', props.classNames, props.className)}>
            {
                !props.withoutIcon &&
                <TeamIcon
                    team={props.team}
                    withHover={true}
                />
            }
            {!props.withoutName &&
                <div className='name'>{props.team.display_name}</div>
            }
            {props.extra}
        </div>
    );
};

export default TeamWithIcon;
