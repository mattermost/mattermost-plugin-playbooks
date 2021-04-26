// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface GlobalSettings {
    playbook_editors_user_ids: string[]
}

const defaults: GlobalSettings = {
    playbook_editors_user_ids: [],
};

export function globalSettingsSetDefaults(globalSettings?: Partial<GlobalSettings>): GlobalSettings {
    let modifiedGlobalSettings = globalSettings;
    if (!modifiedGlobalSettings) {
        modifiedGlobalSettings = {};
    }

    if (!globalSettings?.playbook_editors_user_ids) {
        modifiedGlobalSettings.playbook_editors_user_ids = defaults.playbook_editors_user_ids;
    }

    return {...defaults, ...globalSettings};
}
