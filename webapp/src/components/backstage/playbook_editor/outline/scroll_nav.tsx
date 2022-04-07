// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect, useState, HTMLAttributes} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Icon from '@mdi/react';
import {mdiTextBoxOutline} from '@mdi/js';

import {telemetryEventForPlaybook} from 'src/client';
import {BackstageID} from 'src/components/backstage/backstage';
import {PlaybookWithChecklist} from 'src/types/playbook';

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
        checklists: boolean,
        actions: boolean,
        statusUpdates: boolean,
        retrospective: boolean,
    };
}

type Attrs = HTMLAttributes<HTMLElement>;

// Height of the headers in pixels
const headersOffset = 140;

const ScrollNav = ({playbook, runsInProgress, archived, showElements, ...attrs}: Props & Attrs) => {
    const {formatMessage} = useIntl();
    const [activeId, setActiveId] = useState(SectionID.Description);

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
        <Wrapper
            id='playbook-preview-navbar'
            {...attrs}
        >
            <Header>
                <Icon
                    path={mdiTextBoxOutline}
                    size={1}
                />
                <FormattedMessage defaultMessage='Contents'/>
            </Header>
            <Items>
                <Item
                    id={SectionID.StatusUpdates}
                    title={formatMessage({defaultMessage: 'Status updates'})}
                    show={showElements.statusUpdates}
                />
                <Item
                    id={SectionID.Checklists}
                    title={formatMessage({defaultMessage: 'Checklists'})}
                    show={showElements.checklists}
                />

                <Item
                    id={SectionID.Retrospective}
                    title={formatMessage({defaultMessage: 'Retrospective'})}
                    show={showElements.retrospective}
                />
                <Item
                    id={SectionID.Actions}
                    title={formatMessage({defaultMessage: 'Actions'})}
                    show={showElements.actions}
                />
            </Items>
        </Wrapper>
    );
};

const Wrapper = styled.nav`

`;

const Header = styled.div`
    height: 32px;
    text-transform: uppercase;

    font-weight: 600;
    font-size: 11px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.56);

    padding-left: 12px;
    padding-top: 4px;

    margin-bottom: 8px;

    display: flex;
    align-items: center;
    gap: .75rem;
`;

const Items = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
`;

const generateItemComponent = (isSectionActive: (id: SectionID) => boolean, scrollToSection: (id: SectionID) => void) => {
    return (props: {id: SectionID, title: string, show: boolean}) => {
        if (!props.show) {
            return null;
        }

        return (
            <ItemWrapper
                active={isSectionActive(props.id)}
                onClick={() => scrollToSection(props.id)}
            >
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
    padding-right: 30px;
    cursor: pointer;

    border-radius: 4px;

    margin: 0;

    :not(:last-child) {
        margin-bottom: 8px;
    }

    font-weight: 400;
    font-size: 14px;
    line-height: 14px;

    background: transparent;
    color: var(--center-channel-color);

    ${({active}) => active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    `}

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export default ScrollNav;
