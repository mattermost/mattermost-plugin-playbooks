// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Icon from '@mdi/react';
import {mdiClipboardPlayMultipleOutline} from '@mdi/js';

import {telemetryEventForPlaybook} from 'src/client';
import {BackstageID} from 'src/components/backstage/backstage';
import {PlaybookWithChecklist} from 'src/types/playbook';
import TutorialTourTip from 'src/components/tutorial/tutorial_tour_tip/tutorial_tour_tip';
import {PlaybookPreviewTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';
import {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip/hooks';

const prefix = 'playbooks-playbookPreview-';

export enum SectionID {
    Description = 'playbooks-playbookPreview-description',
    Checklists = 'playbooks-playbookPreview-checklists',
    Actions = 'playbooks-playbookPreview-actions',
    StatusUpdates = 'playbooks-playbookPreview-statusUpdates',
    Retrospective = 'playbooks-playbookPreview-retrospective',
}

interface Props {
    playbook: PlaybookWithChecklist;
    runsInProgress: number;
    archived: boolean;
    showElements: {
        description: boolean,
        checklists: boolean,
        actions: boolean,
        statusUpdates: boolean,
        retrospective: boolean,
    };
}

// Height of the headers in pixels
const headersOffset = 140;

const TabOutlineNavbar = ({playbook, runsInProgress, archived, showElements}: Props) => {
    const {formatMessage} = useIntl();
    const [activeId, setActiveId] = useState(SectionID.Description);
    const punchoutNavbar = useMeasurePunchouts(['playbook-preview-navbar'], [], {y: -5, height: 10, x: -5, width: 10});
    const showNavbarTutorial = useShowTutorialStep(PlaybookPreviewTutorialSteps.Navbar, TutorialTourCategories.PLAYBOOK_PREVIEW);

    const updateActiveSection = () => {
        const threshold = (window.innerHeight / 2) - headersOffset;

        let finalId : SectionID | null = null;
        let finalPos = Number.NEGATIVE_INFINITY;

        // Get the section whose top border is over the middle of the window (the threshold) and closer to it.
        Object.values(SectionID).forEach((id) => {
            const top = document.getElementById(id)?.getBoundingClientRect().top || Number.POSITIVE_INFINITY;
            const pos = top - headersOffset;

            if (pos < threshold && pos > finalPos) {
                finalId = id;
                finalPos = pos;
            }
        });

        if (finalId !== null) {
            setActiveId(finalId);
        }
    };

    useEffect(updateActiveSection, []);

    useEffect(() => {
        const root = document.getElementById(BackstageID);

        if (root === null) {
            return () => { /* do nothing*/ };
        }

        root.addEventListener('scroll', updateActiveSection);

        return () => {
            root.removeEventListener('scroll', updateActiveSection);
        };
    }, [updateActiveSection]);

    const scrollToSection = (id: SectionID) => {
        const idWithoutPrefix = String(id).replace(prefix, '');
        telemetryEventForPlaybook(playbook.id, `playbook_preview_navbar_section_${idWithoutPrefix}_clicked`);

        if (isSectionActive(id)) {
            return;
        }

        const root = document.getElementById(BackstageID);
        const section = document.getElementById(id);

        if (!section || !root) {
            return;
        }

        const amount = section.getBoundingClientRect().top - headersOffset;

        // If there is no need to scroll, simply set the section item as active
        const reachedTop = root.scrollTop === 0;
        const reachedBottom = root.scrollHeight - Math.abs(root.scrollTop) === root.clientHeight;
        if ((amount > 0 && reachedBottom) || (amount < 0 && reachedTop) || amount === 0) {
            setActiveId(id);
            return;
        }

        root.scrollBy({
            top: amount,
            behavior: 'smooth',
        });

        // At this point, we know we are certain scrollBy will generate an actual scroll,
        // so we can listen to the 'scroll' event that was fired because of scrollBy
        // and set the active ID only when it's finished.
        // This is needed because short sections at the bottom may be positioned below
        // the middle of the window, so we need to wait for the scroll event to finish
        // and manually mark the section as active, instead of relying on the automatic
        // updateActiveSection.
        let timer: NodeJS.Timeout;
        const callback = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                setActiveId(id);
                root.removeEventListener('scroll', callback);
            }, 150);
        };

        root.addEventListener('scroll', callback, {passive: true});
    };

    const isSectionActive = (id: SectionID) => {
        return activeId === id;
    };

    const Item = generateItemComponent(isSectionActive, scrollToSection);

    return (
        <Wrapper>
            {showNavbarTutorial &&
            <TutorialTourTip
                title={<FormattedMessage defaultMessage='See what’s in this playbook at any time'/>}
                screen={<FormattedMessage defaultMessage='You can check out different sections of the playbook in detail on this page.'/>}
                tutorialCategory={TutorialTourCategories.PLAYBOOK_PREVIEW}
                step={PlaybookPreviewTutorialSteps.Navbar}
                placement='left'
                pulsatingDotPlacement='left'
                pulsatingDotTranslate={{x: -10, y: -50}}
                autoTour={true}
                width={360}
                punchOut={punchoutNavbar}
                telemetryTag={`tutorial_tip_Playbook_Preview_${PlaybookPreviewTutorialSteps.Navbar}_Navbar`}
            />
            }
            <div
                id={'playbook-preview-navbar'}
            >
                <Header>
                    {formatMessage({defaultMessage: 'In this playbook'})}
                </Header>
                <Items >
                    <Item
                        id={SectionID.Description}
                        iconName={'information-outline'}
                        title={formatMessage({defaultMessage: 'Description'})}
                        show={showElements.description}
                    />
                    <Item
                        id={SectionID.Checklists}
                        iconName={'check-all'}
                        title={formatMessage({defaultMessage: 'Checklists'})}
                        show={showElements.checklists}
                    />
                    <Item
                        id={SectionID.Actions}
                        iconName={'sync'}
                        title={formatMessage({defaultMessage: 'Actions'})}
                        show={showElements.actions}
                    />
                    <Item
                        id={SectionID.StatusUpdates}
                        iconName={'update'}
                        title={formatMessage({defaultMessage: 'Status updates'})}
                        show={showElements.statusUpdates}
                    />
                    <Item
                        id={SectionID.Retrospective}
                        iconName={'lightbulb-outline'}
                        title={formatMessage({defaultMessage: 'Retrospective'})}
                        show={showElements.retrospective}
                    />
                </Items>
            </div>
        </Wrapper>
    );
};

const Wrapper = styled.nav`
    width: 172px;

    position: sticky;
    align-self: flex-start;
    top: 116px;
`;

const Header = styled.div`
    height: 32px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    text-transform: uppercase;

    font-weight: 600;
    font-size: 11px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.56);

    padding-left: 12px;
    padding-top: 4px;

    margin-bottom: 8px;
`;

const Items = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
`;

const generateItemComponent = (isSectionActive: (id: SectionID) => boolean, scrollToSection: (id: SectionID) => void) => {
    return (props: {id: SectionID, iconName: string, title: string, show: boolean}) => {
        if (!props.show) {
            return null;
        }

        return (
            <ItemWrapper
                active={isSectionActive(props.id)}
                onClick={() => scrollToSection(props.id)}
            >
                <i className={`icon-${props.iconName} icon-16`}/>
                {props.title}
            </ItemWrapper>
        );
    };
};

const ItemWrapper = styled.div<{active: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;

    border-radius: 4px;

    margin: 0;

    :not(:last-child) {
        margin-bottom: 8px;
    }

    font-weight: 600;
    font-size: 14px;
    line-height: 14px;

    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    ${({active}) => active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    `}

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    i {
        margin-right: 2px;
    }
`;

export default TabOutlineNavbar;
