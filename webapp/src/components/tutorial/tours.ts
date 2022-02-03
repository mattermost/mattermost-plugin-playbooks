// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//TODO replace with playbooks tutorials here

export const FINISHED = 999;
export const SKIPPED = -999;

export const AutoTourStatus = {
    ENABLED: 0,
    DISABLED: 1,
};

const AutoStatusSuffix = '_at_status';

export const TutorialTourCategories: Record<string, string> = {
    PB_RHS_TOUR: 'pb_rhs_tour',
};

export const PB_RHS_TOUR = {
    START: 0,
    FINISHED,
};

export const TTCategoriesMapToSteps: Record<string, Record<string, number>> = {
    [TutorialTourCategories.PB_RHS_TOUR]: PB_RHS_TOUR,
};

export const TTCategoriesMapToAutoTourStatusKey: Record<string, string> = {
    [TutorialTourCategories.ADMIN_ON_BOARDING]: TutorialTourCategories.ADMIN_ON_BOARDING + AutoStatusSuffix,
};
