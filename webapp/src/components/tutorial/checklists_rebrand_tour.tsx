// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useLocation} from 'react-router-dom';

import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {ChecklistsRebrandTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';

const ChecklistsRebrandTour = () => {
    const location = useLocation();
    const showAppBarIconStep = useShowTutorialStep(
        ChecklistsRebrandTutorialSteps.AppBarIcon,
        TutorialTourCategories.CHECKLISTS_REBRAND,
        true
    );

    // Only show in channel views, not backstage
    const isInChannelView = !location.pathname.includes('/playbooks/');

    // Get the position of the app bar icon
    const appBarIconPunchout = useMeasurePunchouts(
        ['app-bar-icon-playbooks'],
        [],
        {y: 0, height: 0, x: 0, width: 0}
    );

    // Calculate position from punchout - parse CSS pixel values (must be before conditional returns)
    const iconX = appBarIconPunchout?.x ? parseFloat(appBarIconPunchout.x.replace('px', '')) : 0;
    const iconY = appBarIconPunchout?.y ? parseFloat(appBarIconPunchout.y.replace('px', '')) : 0;
    const iconWidth = appBarIconPunchout?.width ? parseFloat(appBarIconPunchout.width.replace('px', '')) : 0;
    const iconHeight = appBarIconPunchout?.height ? parseFloat(appBarIconPunchout.height.replace('px', '')) : 0;

    // Position the dot centered horizontally on the icon, below it
    const dotLeft = (iconX + (iconWidth / 2)) - 7; // Center on icon (7px = half of dot width)
    const dotTop = (iconY + iconHeight) + 4; // 4px gap below icon

    // Fix the positioning to be relative to viewport
    useEffect(() => {
        // Only run if we should show the tour
        if (!isInChannelView || !showAppBarIconStep || !iconX || !iconY || !iconWidth || !iconHeight) {
            return;
        }

        // Use a small delay to ensure the element is rendered
        const fixPosition = () => {
            const dotContainer = document.querySelector('.pb-tutorial-tour-tip__pulsating-dot-ctr');
            const backdrop = document.querySelector('.pb-tutorial-tour-tip__backdrop');

            if (dotContainer) {
                const element = dotContainer as HTMLElement;
                element.style.position = 'fixed';
                element.style.zIndex = '9999';

                // Override the CSS that sets bottom/right based on data-pulsating-dot-placement
                element.style.top = '0';
                element.style.left = '0';
                element.style.bottom = 'auto';
                element.style.right = 'auto';
                element.style.transform = 'none';

                // Apply calculated position
                if (dotLeft && dotTop) {
                    element.style.left = `${dotLeft}px`;
                    element.style.top = `${dotTop}px`;
                }
            }

            // Hide the backdrop
            if (backdrop) {
                (backdrop as HTMLElement).style.display = 'none';
            }

            if (!dotContainer) {
                // Retry if element not found yet
                setTimeout(fixPosition, 50);
            }
        };
        fixPosition();
    }, [isInChannelView, showAppBarIconStep, dotLeft, dotTop, iconX, iconY, iconWidth, iconHeight]);

    if (!isInChannelView) {
        return null;
    }

    if (!showAppBarIconStep) {
        return null;
    }

    // Wait for the app bar icon to be available before showing tour
    // Check if we have valid coordinates (not just the default 0,0,0,0)
    if (!appBarIconPunchout || !iconX || !iconY || !iconWidth || !iconHeight) {
        return null;
    }

    // Debug: log the calculated position
    // eslint-disable-next-line no-console
    console.log('Tour position:', {dotLeft, dotTop, iconX, iconY, iconWidth, iconHeight, punchout: appBarIconPunchout});

    return (
        <TutorialTourTip
            title={
                <FormattedMessage defaultMessage='Playbook Runs are now Checklists'/>
            }
            screen={
                <FormattedMessage defaultMessage='Access your checklists here to track tasks, collaborate with your team, and keep work moving forward.'/>
            }
            tutorialCategory={TutorialTourCategories.CHECKLISTS_REBRAND}
            step={ChecklistsRebrandTutorialSteps.AppBarIcon}
            singleTip={true}
            showOptOut={false}
            placement='bottom'
            pulsatingDotPlacement='bottom'
            pulsatingDotTranslate={{x: 0, y: 0}}
            width={320}
            autoTour={false}
            punchOut={null}
        />
    );
};

export default ChecklistsRebrandTour;

