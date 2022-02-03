// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import {useSelector} from 'react-redux';

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
import TutorialTourTip, {useMeasurePunchouts} from 'src/components/tutorial/tutorial_tour_tip';
import {TutorialTourCategories} from '../tutorial/tours';

const RHSRunDetails = () => {
    const scrollbarsRef = useRef<Scrollbars>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const playbookRun = useSelector(currentPlaybookRun);

    const prevStatus = usePrevious(playbookRun?.current_status);
    useEffect(() => {
        if ((prevStatus !== playbookRun?.current_status) && (playbookRun?.current_status === PlaybookRunStatus.Finished)) {
            scrollbarsRef?.current?.scrollToTop();
        }
    }, [playbookRun?.current_status]);

    const punchout = useMeasurePunchouts(['rhsContainer'], [containerRef], {y: -11, height: 11, x: 0, width: 0});

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

            <TutorialTourTip
                title={'View run details in a side panel'}
                screen={'See who is involved and what needs to be done without leaving the conversation.'}
                tutorialCategory={TutorialTourCategories.PB_RHS_TOUR}
                step={0}
                showOptOut={false}
                placement='left-start'
                pulsatingDotPlacement='top-start'
                pulsatingDotTranslate={{x: -6, y: -6}}
                telemetryTag={'telemetry_prefix_'}
                width={352}
                autoTour={false}
                punchOut={punchout}
            />

        </RHSContainer>
    );
};

export default RHSRunDetails;
