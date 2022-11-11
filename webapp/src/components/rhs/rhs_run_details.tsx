// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useMemo} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useDispatch, useSelector} from 'react-redux';

import {FormattedMessage, useIntl} from 'react-intl';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {debounce} from 'lodash';

import {
    renderThumbHorizontal,
    renderThumbVertical, renderView,
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {currentPlaybookRun} from 'src/selectors';
import RHSAbout from 'src/components/rhs/rhs_about';
import RHSChecklistList, {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
import {usePrevious} from 'src/hooks/general';
import {PlaybookRunStatus} from 'src/types/playbook_run';
import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {FINISHED, RunDetailsTutorialSteps, SKIPPED, TutorialTourCategories} from 'src/components/tutorial/tours';
import {displayRhsRunDetailsTourDialog} from 'src/actions';
import {useTutorialStepper} from '../tutorial/tutorial_tour_tip/manager';
import {browserHistory} from 'src/webapp_globals';
import {usePlaybookRunViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookRunViewTarget} from 'src/types/telemetry';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {useParticipateInRun} from 'src/hooks';

const toastDebounce = 2000;

const RHSRunDetails = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const scrollbarsRef = useRef<Scrollbars>(null);
    const currentUserId = useSelector(getCurrentUserId);

    const playbookRun = useSelector(currentPlaybookRun);
    const isParticipant = playbookRun?.participant_ids.includes(currentUserId);
    usePlaybookRunViewTelemetry(PlaybookRunViewTarget.ChannelsRHSDetails, playbookRun?.id);

    const prevStatus = usePrevious(playbookRun?.current_status);

    const {currentStep: runDetailsStep, setStep: setRunDetailsStep} = useTutorialStepper(TutorialTourCategories.RUN_DETAILS);

    useEffect(() => {
        if ((prevStatus !== playbookRun?.current_status) && (playbookRun?.current_status === PlaybookRunStatus.Finished)) {
            scrollbarsRef?.current?.scrollToTop();
        }
    }, [playbookRun?.current_status]);

    useEffect(() => {
        let isRunDetailTour = false;
        const url = new URL(window.location.href);
        const searchParams = new URLSearchParams(url.searchParams);
        if (searchParams.has('openTakeATourDialog')) {
            isRunDetailTour = true;
            searchParams.delete('openTakeATourDialog');
            browserHistory.replace({pathname: url.pathname, search: searchParams.toString()});
        }
        if ((runDetailsStep === null || parseInt(runDetailsStep, 10) === FINISHED) && isRunDetailTour) {
            dispatch(displayRhsRunDetailsTourDialog({
                onConfirm: () => setRunDetailsStep(RunDetailsTutorialSteps.SidePanel),
                onDismiss: () => setRunDetailsStep(SKIPPED),
            }));
        }
    }, [runDetailsStep]);

    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(playbookRun?.id || '', 'channel_rhs');
    const addToast = useToaster().add;
    const removeToast = useToaster().remove;
    const displayReadOnlyToast = useMemo(() => debounce(() => {
        let toastID = -1;
        const showConfirm = () => {
            removeToast(toastID);
            showParticipateConfirm();
        };
        toastID = addToast({
            content: formatMessage({defaultMessage: 'Become a participant to interact with this run'}),
            toastStyle: ToastStyle.Informational,
            buttonName: formatMessage({defaultMessage: 'Participate'}),
            buttonCallback: showConfirm,
            iconName: 'account-plus-outline',
        });
    }, toastDebounce, {leading: true, trailing: false}), []);

    const rhsContainerPunchout = useMeasurePunchouts(
        ['rhsContainer'],
        [],
        {y: 0, height: 0, x: 0, width: 0},
    );
    const showRunDetailsSidePanelStep = useShowTutorialStep(RunDetailsTutorialSteps.SidePanel, TutorialTourCategories.RUN_DETAILS, false);

    if (!playbookRun) {
        return null;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <Scrollbars
                    ref={scrollbarsRef}
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    style={{position: 'absolute'}}
                >
                    <RHSAbout
                        playbookRun={playbookRun}
                        readOnly={!isParticipant}
                        onReadOnlyInteract={playbookRun.current_status === PlaybookRunStatus.Finished ? undefined : displayReadOnlyToast}
                    />
                    <RHSChecklistList
                        playbookRun={playbookRun}
                        parentContainer={ChecklistParent.RHS}
                        viewerMode={!isParticipant}
                        onViewerModeInteract={playbookRun.current_status === PlaybookRunStatus.Finished ? undefined : displayReadOnlyToast}
                    />
                </Scrollbars>
            </RHSContent>
            {ParticipateConfirmModal}
            {showRunDetailsSidePanelStep && (
                <TutorialTourTip
                    title={<FormattedMessage defaultMessage='View run details in a side panel'/>}
                    screen={<FormattedMessage defaultMessage='See who is involved and what needs to be done without leaving the conversation.'/>}
                    tutorialCategory={TutorialTourCategories.RUN_DETAILS}
                    step={RunDetailsTutorialSteps.SidePanel}
                    showOptOut={false}
                    placement='left-start'
                    pulsatingDotPlacement='top-start'
                    pulsatingDotTranslate={{x: 0, y: -7}}
                    width={352}
                    autoTour={true}
                    punchOut={rhsContainerPunchout}
                    telemetryTag={`tutorial_tip_Playbook_Run_Details_${RunDetailsTutorialSteps.SidePanel}_SidePanel`}
                />
            )}
        </RHSContainer>
    );
};

export default RHSRunDetails;
