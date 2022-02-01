// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//TODO replace with playbooks tutorials here

export const FINISHED = 999;

export const AutoTourStatus = {
    ENABLED: 0,
    DISABLED: 1,
};

const AutoStatusSuffix = '_at_status';

export const TutorialTourCategories: Record<string, string> = {
    ADMIN_ON_BOARDING: 'admin_on_boarding',
};

export const AdminOnBoardingTourSteps = {
    ADD_FIRST_CHANNEL: 0,
    POST_POPOVER: 1,
    CHANNEL_POPOVER: 2,
    ADD_CHANNEL_POPOVER: 3,
    MENU_POPOVER: 4,
    PRODUCT_SWITCHER: 5,
    SETTINGS: 6,
    FINISHED,
};

export const TTCategoriesMapToSteps: Record<string, Record<string, number>> = {
    [TutorialTourCategories.ADMIN_ON_BOARDING]: AdminOnBoardingTourSteps,
};

export const TTCategoriesMapToAutoTourStatusKey: Record<string, string> = {
    [TutorialTourCategories.ADMIN_ON_BOARDING]: TutorialTourCategories.ADMIN_ON_BOARDING + AutoStatusSuffix,
};
