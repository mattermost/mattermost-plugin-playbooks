import qs from 'qs';
import {useEffect, useMemo} from 'react';

import {Team} from 'mattermost-redux/types/teams';

import {GlobalState} from 'mattermost-redux/types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {useSelector} from 'react-redux';

import {navigateToPluginUrl, pluginUrl} from 'src/browser_routing';
import {Playbook} from 'src/types/playbook';
import {tabInfo} from 'src/components/backstage/playbook_edit/playbook_edit';

import {useExperimentalFeaturesEnabled} from './general';

type PlaybooksRoutingOptions<T> = {
    urlOnly?: boolean,
    onGo?: (arg: T) => void
}

export type PlaybookCreateQueryParameters = {
    teamId?: string,
    name?: string,
    template?: string,
    description?: string,
    public?: boolean
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
    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();
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
            edit: (p: TParam, tabId?: typeof tabInfo[number]['id']) => {
                if (experimentalFeaturesEnabled) {
                    return go(`/playbooks/${id(p)}/editor/outline`);
                }
                return go(`/playbooks/${id(p)}/edit${tabId ? `/${tabId}` : ''}`, p);
            },
            view: (p: TParam) => {
                if (experimentalFeaturesEnabled) {
                    return go(`/playbooks/${id(p)}/editor`);
                }
                return go(`/playbooks/${id(p)}`, p);
            },
            create: (params: PlaybookCreateQueryParameters) => {
                const queryParams = qs.stringify(params, {addQueryPrefix: true});
                return go(`/playbooks/new${queryParams}`);
            },
        };
    }, [onGo, urlOnly]);
}

const selectSiteName = (state: GlobalState) => getConfig(state).SiteName;

export function useForceDocumentTitle(title: string) {
    const siteName = useSelector(selectSiteName);

    // Restore original title
    useEffect(() => {
        const original = document.title;
        return () => {
            document.title = original;
        };
    }, []);

    // Update title
    useEffect(() => {
        document.title = title + ' - ' + siteName;
    }, [title, siteName]);
}
