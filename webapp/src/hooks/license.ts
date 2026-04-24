// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useAppSelector} from 'src/hooks/redux';

import {isEnterpriseLicensedOrDevelopment, isProfessionalLicensedOrDevelopment} from 'src/license';

// useAllowAddMessageToTimelineInCurrentTeam returns whether a user can add a
// post to the timeline in the current team
export function useAllowAddMessageToTimelineInCurrentTeam() {
    return useAppSelector(isProfessionalLicensedOrDevelopment);
}

// useAllowChannelExport returns whether exporting the channel is allowed
export function useAllowChannelExport() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowPlaybookStatsView returns whether the server is licensed to show
// the stats in the playbook backstage dashboard
export function useAllowPlaybookStatsView() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowPlaybookAndRunMetrics returns whether the server is licensed to
// enter and show playbook and run metrics
export function useAllowPlaybookAndRunMetrics() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowRetrospectiveAccess returns whether the server is licenced for
// the retrospective feature.
export function useAllowRetrospectiveAccess() {
    return useAppSelector(isProfessionalLicensedOrDevelopment);
}

// useAllowPrivatePlaybooks returns whether the server is licenced for
// creating private playbooks
export function useAllowPrivatePlaybooks() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowSetTaskDueDate returns whether the server is licensed for
// setting / editing checklist item due date
export function useAllowSetTaskDueDate() {
    return useAppSelector(isProfessionalLicensedOrDevelopment);
}

// useAllowMakePlaybookPrivate returns whether the server is licenced for
// converting public playbooks to private
export function useAllowMakePlaybookPrivate() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowRequestUpdate returns whether the server is licenced for
// requesting an update
export function useAllowRequestUpdate() {
    return useAppSelector(isProfessionalLicensedOrDevelopment);
}

// useAllowPlaybookAttributes returns whether playbook attributes are enabled
export function useAllowPlaybookAttributes() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowConditionalPlaybooks returns whether conditional playbooks are enabled
export function useAllowConditionalPlaybooks() {
    return useAppSelector(isEnterpriseLicensedOrDevelopment);
}
