//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import {isMobile} from './mobile';

import {navigateToPluginUrl} from './browser_routing';

export function makeUpdateMainMenu(registry: PluginRegistry): () => Promise<void> {
    let mainMenuActionId: string | null;

    return async () => {
        const show = !isMobile();

        if (mainMenuActionId && !show) {
            const temp = mainMenuActionId;
            mainMenuActionId = null;
            registry.unregisterComponent(temp);
        } else if (!mainMenuActionId && show) {
            mainMenuActionId = 'notnull';
            mainMenuActionId = registry.registerMainMenuAction(
                'Playbooks',
                () => {
                    navigateToPluginUrl('');
                },
            );
        }
    };
}

