import qs from 'qs';
import {useMemo} from 'react';

import {Team} from 'mattermost-redux/types/teams';

import {navigateToPluginUrl, pluginUrl} from 'src/browser_routing';
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
 * @param options - {@link PlaybooksRoutingOptions} alters behavior of hook
 *
 * @example Get URL to go view the given playbook
 * const {view} = usePlaybooksRouting({urlOnly: true});
 * const url = view(id);
 *
 * @example Navigate to the backstage edit page for the given playbook
 * const playbookRouting = usePlaybooksRouting();
 * playbookRouting.edit(id);
 */
export function usePlaybooksRouting<TParam extends Playbook | Playbook['id']>(
    {urlOnly, onGo}: PlaybooksRoutingOptions<TParam> = {},
) {
    return useMemo(() => {
        function go(path: string, p?: TParam) {
            if (!urlOnly) {
                if (p) {
                    onGo?.(p);
                }
                navigateToPluginUrl(path);
            }

            return pluginUrl(path);
        }

        return {
            edit: (p: TParam, teamId: string, tabId?: typeof tabInfo[number]['id']) => {
                return go(`/playbooks/${id(p)}/edit${tabId ? `/${tabId}` : ''}/teamId=${teamId}`, p);
            },
            view: (p: TParam) => {
                return go(`/playbooks/${id(p)}`, p);
            },
            create: (team: Team, templateTitle?: string) => {
                const queryParams = qs.stringify({teamId: team.id, [TEMPLATE_TITLE_KEY]: templateTitle}, {addQueryPrefix: true});
                return go(`/playbooks/new${queryParams}`);
            },
        };
    }, [onGo, urlOnly]);
}
