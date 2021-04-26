// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface GlobalSettings {
    playbook_creators_user_ids: string[]
}

const defaults: GlobalSettings = {
    playbook_creators_user_ids: [],
};

export function globalSettingsSetDefaults(globalSettings?: Partial<GlobalSettings>): GlobalSettings {
    let modifiedGlobalSettings = globalSettings;
    if (!modifiedGlobalSettings) {
        modifiedGlobalSettings = {};
    }

    if (!globalSettings?.playbook_creators_user_ids) {
        modifiedGlobalSettings.playbook_creators_user_ids = defaults.playbook_creators_user_ids;
    }

    return {...defaults, ...globalSettings};
}
