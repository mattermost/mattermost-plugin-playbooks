import qs from 'qs';
import {useMemo} from 'react';

import {Team} from 'mattermost-redux/types/teams';

import {navigateToTeamPluginUrl, teamPluginUrl} from 'src/browser_routing';
import {TEMPLATE_TITLE_KEY} from 'src/constants';
import {Playbook} from 'src/types/playbook';
import {tabInfo} from 'src/components/backstage/playbook_edit';

type PlaybooksRoutingOptions<T> = {
    urlOnly?: boolean,
    onGo?: (arg: T) => void
}

function id(p: Playbook | Playbook['id']) {
    return p && typeof p !== 'string' ? p.id : p;
}

/**
 * Access backstage routing functions for a given team.
 * @typeParam T - Type of routing function parameter and argument in callback. Must be {@link Playbook} or {@link Playbook.id}.
 * @param teamName - Which team-backstage to go to. (see {@link navigateToTeamPluginUrl})
 * @param options - {@link PlaybooksRoutingOptions} alters behavior of hook
 *
 * @example Get URL to go view the given playbook
 * const {view} = usePlaybooksRouting(currentTeam.name, {urlOnly: true});
 * const url = view(id);
 *
 * @example Navigate to the backstage edit page for the given playbook
 * const playbookRouting = usePlaybooksRouting(currentTeam.name);
 * playbookRouting.edit(id);
 */
export function usePlaybooksRouting<TParam extends Playbook | Playbook['id']>(
    teamName: Team['name'],
    {urlOnly, onGo}: PlaybooksRoutingOptions<TParam> = {},
) {
    return useMemo(() => {
        function go(path: string, p?: TParam) {
            if (!urlOnly) {
                if (p) {
                    onGo?.(p);
                }
                navigateToTeamPluginUrl(teamName, path);
            }
            return teamPluginUrl(teamName, path);
        }

        return {
            edit: (p: TParam, tabId?: typeof tabInfo[number]['id']) => {
                return go(`/playbooks/${id(p)}/edit${tabId ? `/${tabId}` : ''}`, p);
            },
            view: (p: TParam) => {
                return go(`/playbooks/${id(p)}`, p);
            },
            create: (templateTitle?: string) => {
                const queryParams = qs.stringify({[TEMPLATE_TITLE_KEY]: templateTitle}, {addQueryPrefix: true});
                return go(`/playbooks/new${queryParams}`);
            },
            createInTeam: (team:Team, templateTitle?: string) => {
                const queryParams = qs.stringify({team_id: team.id, [TEMPLATE_TITLE_KEY]: templateTitle}, {addQueryPrefix: true});
                navigateToTeamPluginUrl(team.name, `/playbooks/new${queryParams}`);
            },
        };
    }, [teamName, onGo, urlOnly]);
}
