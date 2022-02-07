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
    PB_TOUR_EX: 'tutorial_pb_tour_ex',
    RUN_DETAILS: 'tutorial_pb_run_details',
};

export const PB_TOUR_EX = {
    START: 0,
    FINISHED,
};

export const RunDetailsTutorialSteps = {
    SidePanel: 0,
    PostUpdate: 1,
    Checklists: 2,
    FINISHED,
};

export const TTCategoriesMapToSteps: Record<string, Record<string, number>> = {
    [TutorialTourCategories.PB_TOUR_EX]: PB_TOUR_EX,
    [TutorialTourCategories.RUN_DETAILS]: RunDetailsTutorialSteps,
};

export const TTCategoriesMapToAutoTourStatusKey = Object.values(TutorialTourCategories).reduce((result, category) => {
    result[category] = category + AutoStatusSuffix;
    return result;
}, {} as Record<string, string>);
