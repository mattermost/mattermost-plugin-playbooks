// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';

import {Team} from 'mattermost-redux/types/teams';
import {Client4} from 'mattermost-redux/client';

import './team_icon.scss';

interface Props {
    team: Team;
    withHover?: boolean;
    className?: string;
}

/**
 * An icon representing a Team. If team has an icon - shows the image,
 * otherwise shows team initials
 */
const TeamIcon = (props: Props) => {
    function imageURLForTeam(team: any) {
        return team.last_team_icon_update ? Client4.getTeamIconUrl(team.id, team.last_team_icon_update) : null;
    }

    const hoverCss = props.withHover ? '' : 'no-hover';

    const teamIconUrl = imageURLForTeam(props.team);
    let icon;
    if (teamIconUrl) {
        icon = (
            <div
                data-testid='teamIconImage'
                className={'TeamIcon__image TeamIcon__sm'}
                aria-label={'Team Icon'}
                style={{backgroundImage: `url('${teamIconUrl}')`}}
            />
        );
    } else {
        icon = (
            <div
                data-testid='teamIconInitial'
                className={'TeamIcon__initials TeamIcon__initials__sm'}
                aria-label={'Team Initials'}
            >
                {props.team.display_name ? props.team.display_name.replace(/\s/g, '').substring(0, 2) : '??'}
            </div>
        );
    }

    return (
        <div className={classNames('TeamIcon TeamIcon__sm', {withImage: teamIconUrl}, props.className, hoverCss)}>
            <div className={`TeamIcon__content ${hoverCss}`}>
                {icon}
            </div>
        </div>
    );
};

export default TeamIcon;
