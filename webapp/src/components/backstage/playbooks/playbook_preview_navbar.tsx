// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useRouteMatch} from 'react-router-dom';

import Icon from '@mdi/react';
import {mdiClipboardPlayMultipleOutline} from '@mdi/js';

import {navigateToUrl} from 'src/browser_routing';
import {SecondaryButtonLargerRight} from 'src/components/backstage/playbook_runs/shared';
import {BackstageID} from 'src/components/backstage/backstage';

export enum SectionID {
    Checklists = 'checklists',
    Actions = 'actions',
    StatusUpdates = 'statusUpdates',
    Retrospective = 'retrospective',
}

interface Props {
    runsInProgress: number;
}

// Height of the headers in pixels
const headersOffset = 140;

const PlaybookPreviewNavbar = ({runsInProgress}: Props) => {
    const {formatMessage} = useIntl();
    const match = useRouteMatch();
    const [activeId, setActiveId] = useState(SectionID.Checklists);

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
        return () => {
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
            let timer : NodeJS.Timeout;
            const callback = () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    setActiveId(id);
                    root.removeEventListener('scroll', callback);
                }, 150);
            };

            root.addEventListener('scroll', callback, {passive: true});
        };
    };

    const isSectionActive = (id: SectionID) => {
        return activeId === id;
    };

    return (
        <Wrapper>
            <EditButton onClick={() => navigateToUrl(match.url.replace('/preview', '/edit'))}>
                <i className={'icon-pencil-outline icon-16'}/>
                {formatMessage({defaultMessage: 'Edit'})}
            </EditButton>
            <Header>
                {formatMessage({defaultMessage: 'In this playbook'})}
            </Header>
            <Items>
                <Item
                    active={isSectionActive(SectionID.Checklists)}
                    onClick={scrollToSection(SectionID.Checklists)}
                >
                    <i className={'icon-check-all icon-16'}/>
                    {formatMessage({defaultMessage: 'Checklists'})}
                </Item>
                <Item
                    active={isSectionActive(SectionID.Actions)}
                    onClick={scrollToSection(SectionID.Actions)}
                >
                    <i className={'icon-sync icon-16'}/>
                    {formatMessage({defaultMessage: 'Actions'})}
                </Item>
                <Item
                    active={isSectionActive(SectionID.StatusUpdates)}
                    onClick={scrollToSection(SectionID.StatusUpdates)}
                >
                    <i className={'icon-update icon-16'}/>
                    {formatMessage({defaultMessage: 'Status updates'})}
                </Item>
                <Item
                    active={isSectionActive(SectionID.Retrospective)}
                    onClick={scrollToSection(SectionID.Retrospective)}
                >
                    <i className={'icon-lightbulb-outline icon-16'}/>
                    {formatMessage({defaultMessage: 'Retrospective'})}
                </Item>
            </Items>
            <UsageButton activeRuns={runsInProgress}/>
        </Wrapper>
    );
};

const Wrapper = styled.nav`
    width: 172px;

    position: sticky;
    align-self: flex-start;
    top: 116px;
`;

const EditButton = styled(SecondaryButtonLargerRight)`
    width: 100%;
    justify-content: center;
    margin-bottom: 16px;
    font-size: 14px;
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

const Item = (props: {active: boolean, onClick: () => void, children: React.ReactNode}) => {
    return (
        <ItemWrapper
            active={props.active}
            onClick={props.onClick}
        >
            {props.children}
        </ItemWrapper>
    );
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

const UsageButton = ({activeRuns}: {activeRuns: number}) => {
    const match = useRouteMatch();
    const {formatMessage} = useIntl();

    return (
        <UsageButtonWrapper onClick={() => navigateToUrl(match.url.replace('/preview', '/usage'))}>
            <Icon
                path={mdiClipboardPlayMultipleOutline}
                size={1.2}
            />
            {formatMessage(
                {defaultMessage: '{activeRuns, number} active {activeRuns, plural, one {run} other {runs}}'},
                {activeRuns},
            )}
            <i className='icon-arrow-right icon-16'/>
        </UsageButtonWrapper>
    );
};

const UsageButtonWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;

    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;

    font-size: 14px;
    line-height: 20px;

    color: rgba(var(--center-channel-color-rgb), 0.64);

    i {
        margin-left: auto;
        opacity: 0.48;
    }

    svg {
        margin-right: 7px;
    }

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export default PlaybookPreviewNavbar;
