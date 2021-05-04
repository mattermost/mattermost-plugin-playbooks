import {Store} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';

//@ts-ignore Webapp imports don't work properly
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {isDisabledOnCurrentTeam} from './selectors';
import {isMobile} from './mobile';
import {isE20LicensedOrDevelopment, isPricingPlanDifferentiationEnabled} from './license';

import {navigateToTeamPluginUrl} from './browser_routing';

export function makeUpdateMainMenu(registry: PluginRegistry, store: Store<GlobalState>): () => Promise<void> {
    let mainMenuActionId: string | null;

    return async () => {
        let show = !isMobile();

        if (!isPricingPlanDifferentiationEnabled(store.getState())) {
            const disable = isDisabledOnCurrentTeam(store.getState());
            show = !disable && !isMobile() && isE20LicensedOrDevelopment(store.getState());
        }

        if (mainMenuActionId && !show) {
            const temp = mainMenuActionId;
            mainMenuActionId = null;
            registry.unregisterComponent(temp);
        } else if (!mainMenuActionId && show) {
            mainMenuActionId = 'notnull';
            mainMenuActionId = registry.registerMainMenuAction(
                'Incident Collaboration',
                () => {
                    const team = getCurrentTeam(store.getState());
                    navigateToTeamPluginUrl(team.name, '');
                },
            );
        }
    };
}

