// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';

import {getChannelsNameMapInTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {useAppSelector} from 'src/hooks/redux';

import {formatText, messageHtmlToComponent} from 'src/webapp_globals';

export const useDefaultMarkdownOptions = ({team, ...opts}: {team?: Maybe<Team | Team['id']>} & Record<string, any> = {}) => {
    const selectedTeam = useAppSelector((state) => {
        if (typeof team === 'string') {
            return getTeam(state, team);
        }
        return team ?? getCurrentTeam(state);
    });
    const channelNamesMap = useAppSelector((state) => selectedTeam && getChannelsNameMapInTeam(state, selectedTeam.id));

    return {
        singleline: false,
        atMentions: true,
        mentionHighlight: false,
        team: selectedTeam,
        channelNamesMap,
        ...opts,
    };
};

type Props = {
    value: string;
    teamId?: string;
    options?: Record<string, any>;
};

const FormattedMarkdown = ({
    value,
    options,
}: Props) => {
    const opts = useDefaultMarkdownOptions(options);
    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    return messageHtmlToComponent(formatText(value, opts), true, messageHtmlToComponentOptions);
};

export default FormattedMarkdown;
