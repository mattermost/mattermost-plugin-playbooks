// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {checkProfessionalLicensed, isEnterpriseLicensedOrDevelopment} from 'src/license';

// useAllowAddMessageToTimelineInCurrentTeam returns whether a user can add a
// post to the timeline in the current team
export function useAllowAddMessageToTimelineInCurrentTeam() {
    return useSelector(checkProfessionalLicensed);
}

// useAllowChannelExport returns whether exporting the channel is allowed
export function useAllowChannelExport() {
    return useSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowPlaybookStatsView returns whether the server is licensed to show
// the stats in the playbook backstage dashboard
export function useAllowPlaybookStatsView() {
    return useSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowPlaybookAndRunMetrics returns whether the server is licensed to
// enter and show playbook and run metrics
export function useAllowPlaybookAndRunMetrics() {
    return useSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowRetrospectiveAccess returns whether the server is licenced for
// the retrospective feature.
export function useAllowRetrospectiveAccess() {
    return useSelector(checkProfessionalLicensed);
}

// useAllowPrivatePlaybooks returns whether the server is licenced for
// creating private playbooks
export function useAllowPrivatePlaybooks() {
    return useSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowSetTaskDueDate returns whether the server is licensed for
// setting / editing checklist item due date
export function useAllowSetTaskDueDate() {
    return useSelector(checkProfessionalLicensed);
}

// useAllowMakePlaybookPrivate returns whether the server is licenced for
// converting public playbooks to private
export function useAllowMakePlaybookPrivate() {
    return useSelector(isEnterpriseLicensedOrDevelopment);
}

// useAllowRequestUpdate returns whether the server is licenced for
// requesting an update
export function useAllowRequestUpdate() {
    return useSelector(checkProfessionalLicensed);
}
