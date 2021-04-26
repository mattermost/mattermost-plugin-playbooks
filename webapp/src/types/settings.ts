// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface GlobalSettings {
    playbook_editors_user_ids: string[]
}

const defaults: GlobalSettings = {
    playbook_editors_user_ids: [],
};

export function globalSettingsSetDefaults(globalSettings?: Partial<GlobalSettings>): GlobalSettings {
    return {...defaults, ...globalSettings};
}
