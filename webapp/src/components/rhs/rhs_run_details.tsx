// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useSelector} from 'react-redux';

import {FormattedMessage} from 'react-intl';

import {
    renderThumbHorizontal,
    renderThumbVertical, renderView,
    RHSContainer,
    RHSContent,
} from 'src/components/rhs/rhs_shared';
import {currentPlaybookRun} from 'src/selectors';
import RHSAbout from 'src/components/rhs/rhs_about';
import RHSChecklistList from 'src/components/rhs/rhs_checklist_list';
import {usePrevious} from 'src/hooks/general';
import {PlaybookRunStatus} from 'src/types/playbook_run';
import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {RunDetailsTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';

const RHSRunDetails = () => {
    const scrollbarsRef = useRef<Scrollbars>(null);

    const playbookRun = useSelector(currentPlaybookRun);

    const prevStatus = usePrevious(playbookRun?.current_status);
    useEffect(() => {
        if ((prevStatus !== playbookRun?.current_status) && (playbookRun?.current_status === PlaybookRunStatus.Finished)) {
            scrollbarsRef?.current?.scrollToTop();
        }
    }, [playbookRun?.current_status]);

    const rhsContainerPunchout = useMeasurePunchouts(
        ['rhsContainer'],
        [],
        {y: 0, height: 0, x: 0, width: 0},
    );
    const startRunDetailsTour = false;
    const showRunDetailsSidePanelStep = useShowTutorialStep(RunDetailsTutorialSteps.SidePanel, TutorialTourCategories.RUN_DETAILS) && startRunDetailsTour;

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
                    <RHSAbout playbookRun={playbookRun}/>
                    <RHSChecklistList playbookRun={playbookRun}/>
                </Scrollbars>
            </RHSContent>

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
                />
            )}
        </RHSContainer>
    );
};

export default RHSRunDetails;
