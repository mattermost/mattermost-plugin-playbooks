// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled, {css} from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {ArrowDownIcon, ArrowRightIcon, PlusIcon} from '@mattermost/compass-icons/components';

import {FormattedMessage} from 'react-intl';

import {PresetTemplates} from 'src/components/templates/template_data';

import {DraftPlaybookWithChecklist, Playbook} from 'src/types/playbook';
import {SemiBoldHeading} from 'src/styles/headings';

import {
    RHSContainer,
    RHSContent,
    renderThumbVertical,
    renderTrackHorizontal,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {displayPlaybookCreateModal, setRHSViewingPlaybookRun} from 'src/actions';
import {currentPlaybookRun} from 'src/selectors';
import {telemetryEventForTemplate} from 'src/client';

import {
    getPlaybookOrFetch,
    useHasTeamPermission,
    usePlaybooksCrud,
    usePlaybooksRouting,
} from 'src/hooks';
import {navigateToUrl} from 'src/browser_routing';

import {RHSHomePlaybook, RHSHomeTemplate} from 'src/components/rhs/rhs_home_item';
import BoxOpenSvg from 'src/components/assets/box_open_svg';
import PageRunSvg from 'src/components/assets/page_run_svg';
import PageRunCollaborationSvg from 'src/components/assets/page_run_collaboration_svg';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';

import {RHSTitleText} from './rhs_title_common';

const WelcomeBlock = styled.div`
    padding: 4rem 3rem 2rem;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const WelcomeDesc = styled.p`
    font-size: 14px;
    line-height: 21px;
    font-weight: 400;
    margin-bottom: 3rem;
`;

const WelcomeCreateAlt = styled.span`
    display: inline-flex;
    align-items: center;
    vertical-align: top;
    padding: 1rem 0;

    > svg {
        margin-left: 0.5em;
    }
`;

const WelcomeButtonCreate = styled(PrimaryButton)`
    margin-right: 2rem;
    margin-bottom: 1rem;
    padding: 0 2rem;

    > svg {
        margin-right: 0.5rem;
    }
`;

const WelcomeWarn = styled(WelcomeDesc)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const RunDetailMaskSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="calc(100% - 15px)" viewBox="0 0 400 137" preserveAspectRatio="none"><path d="M0 0H400V122.629C400 122.629 312 137 200 137C101.5 137 0 122.629 0 122.629V0Z"/></svg>';
type RunDetailProps = { exists: boolean; };

const RunDetail = styled.div<RunDetailProps>`
    display: flex;
    place-content: flex-start;
    place-items: center;
    padding: 2rem 2rem 2rem 4rem;
    background:
        linear-gradient(
            180deg,
            rgba(var(--center-channel-bg-rgb), 0.85) 0%,
            rgba(var(--center-channel-bg-rgb), 0.25) 100%
        ),
        rgba(var(${({exists}) => (exists ? '--button-bg-rgb' : '--center-channel-color-rgb')}), 0.08);
    mask-mode: alpha;
    mask-size: cover;
    mask-repeat: round;
    mask-image: url('${RunDetailMaskSvg}');

    > div {
        margin-left: 2rem;
    }
`;

const RunDetailDesc = styled.span<RunDetailProps>`
    font-weight: 400;
    margin-right: auto;
    display: inline-block;
    margin-right: 2rem;
    ${({exists}) => (exists ? css`
        font-size: 14px;
        line-height: 20px;
        color: var(--button-bg);
    ` : css`
        color: '#6F6F73';
        font-size: 16px;
        line-height: 24px;
    `)}
`;

const RunDetailButton = styled(PrimaryButton)`
    height: 3.25rem;
    font-size: 12px;
    padding: 0 1.6rem;

    margin-top: 1rem;
    margin-right: 2rem;

    svg {
        margin-left: 0.5rem;
    }
`;

const Header = styled.div`
    min-height: 13rem;
    margin-bottom: 4rem;
    display: grid;
`;

const Heading = styled.h4`
    font-size: 18px;
    line-height: 24px;
    font-weight: 700;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ListHeading = styled(Heading)`
    ${SemiBoldHeading} {
    }

    padding-left: 2.75rem;
`;

const PaginationContainer = styled.div`
    position: relative;
    height: 0;
    top: -5rem;
    display: flex;
    justify-content: center;
    padding-top: 1rem;

    button {
        height: 3.25rem;
    }
`;

const ListSection = styled.div`
    margin-top: 1rem;
    margin-bottom: 5rem;
    box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-template-rows: repeat(auto-fill, minmax(100px, 1fr));
    position: relative;

    &::after {
        content: '';
        display: block;
        position: absolute;
        width: 100%;
        height: 1px;
        bottom: 0;
        box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

interface Props {
    onRunCreated: (runId: string, channelId: string) => void;
}

const RHSHome = ({onRunCreated}: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const currentRun = useSelector(currentPlaybookRun);
    const hasCurrentRun = Boolean(currentRun);
    const [currentPlaybook, setCurrentPlaybook] = useState<Playbook | null>();

    const permissionForPublic = useHasTeamPermission(currentTeam.id || '', 'playbook_public_create');
    const permissionForPrivate = useHasTeamPermission(currentTeam.id || '', 'playbook_private_create');
    const canCreatePlaybooks = permissionForPublic || permissionForPrivate;

    const [playbooks, {hasMore, isLoading}, {setPage}] = usePlaybooksCrud({team_id: currentTeam.id}, {infinitePaging: true});
    const {create} = usePlaybooksRouting<Playbook>();

    const newPlaybook = (template?: DraftPlaybookWithChecklist) => {
        if (template) {
            telemetryEventForTemplate(template.title, 'use_template_option');
        }

        dispatch(displayPlaybookCreateModal({startingTemplate: template?.title, startingTeamId: currentTeam.id}));
    };

    useEffect(() => {
        (async () => {
            setCurrentPlaybook((currentRun && playbooks && await getPlaybookOrFetch(currentRun.playbook_id, playbooks)) || null);
        })();
    }, [currentRun, playbooks]);

    const viewCurrentPlaybookRun = () => {
        if (currentRun) {
            dispatch(setRHSViewingPlaybookRun());
            navigateToUrl(`/${currentTeam.name}/channels/${currentRun.channel_id}`);
        }
    };

    let headerContent;
    if (playbooks?.length === 0 && !currentPlaybook) {
        headerContent = (
            <WelcomeBlock>
                <PageRunCollaborationSvg/>
                <Heading>
                    <FormattedMessage defaultMessage='Welcome to Playbooks!'/>
                </Heading>
                <WelcomeDesc>
                    <FormattedMessage
                        defaultMessage='A playbook prescribes the checklists, automations, and templates for any repeatable procedures. {br} It helps teams reduce errors, earn trust with stakeholders, and become more effective with every iteration.'
                        values={{br: <br/>}}
                    />
                </WelcomeDesc>
                {canCreatePlaybooks ? (
                    <div>
                        <WelcomeButtonCreate
                            onClick={() => newPlaybook()}
                        >
                            <PlusIcon size={16}/>
                            <FormattedMessage defaultMessage='Create playbook'/>
                        </WelcomeButtonCreate>
                        <WelcomeCreateAlt>
                            <FormattedMessage defaultMessage='…or start with a template'/>
                            <ArrowDownIcon size={16}/>
                        </WelcomeCreateAlt>
                    </div>
                ) : (
                    <WelcomeWarn>
                        <FormattedMessage defaultMessage="There are no playbooks to view. You don't have permission to create playbooks in this workspace."/>
                    </WelcomeWarn>
                )}
            </WelcomeBlock>
        );
    } else {
        headerContent = (
            <RunDetail exists={hasCurrentRun}>
                {hasCurrentRun ? <PageRunSvg/> : <BoxOpenSvg/>}
                <div>
                    <RunDetailDesc exists={hasCurrentRun}>
                        {
                            hasCurrentRun ? (
                                <>
                                    <FormattedMessage
                                        defaultMessage='Currently running the <strong>{playbookTitle}</strong> playbook'
                                        values={{
                                            strong: (x: React.ReactNode) => <strong>{x}</strong>,
                                            playbookTitle: currentPlaybook?.title,
                                        }}
                                    />
                                </>
                            ) : (
                                <span>
                                    <FormattedMessage defaultMessage='This channel is not running any playbook.'/>
                                </span>
                            )
                        }
                    </RunDetailDesc>
                    {hasCurrentRun && (
                        <RunDetailButton onClick={viewCurrentPlaybookRun}>
                            <span>
                                <FormattedMessage defaultMessage='View run details'/>
                                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                                {' '}
                            </span>
                            <ArrowRightIcon size={16}/>
                        </RunDetailButton>
                    )}
                </div>
            </RunDetail>
        );
    }

    return (
        <>
            <RHSTitleRemoteRender>
                <RHSTitleText>
                    {/* product name; don't translate */}
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {'Playbooks'}
                </RHSTitleText>
            </RHSTitleRemoteRender>
            <RHSContainer>
                <RHSContent>
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderThumbVertical={renderThumbVertical}
                        renderView={renderView}
                        renderTrackHorizontal={renderTrackHorizontal}
                        style={{position: 'absolute'}}
                    >
                        {!isLoading && <Header>{headerContent}</Header>}

                        {Boolean(playbooks?.length) && (
                            <>
                                <ListHeading><FormattedMessage defaultMessage='Your Playbooks'/></ListHeading>
                                <ListSection>
                                    {playbooks?.map((p) => (
                                        <RHSHomePlaybook
                                            key={p.id}
                                            playbook={p}
                                            onRunCreated={onRunCreated}
                                        />
                                    ))}
                                </ListSection>
                                {hasMore && (
                                    <PaginationContainer>
                                        <TertiaryButton
                                            onClick={() => setPage()}
                                        >
                                            <FormattedMessage defaultMessage='Show more'/>
                                        </TertiaryButton>
                                    </PaginationContainer>
                                )}
                            </>
                        )}

                        {canCreatePlaybooks && (
                            <>
                                <ListHeading><FormattedMessage defaultMessage='Playbook Templates'/></ListHeading>
                                <ListSection>
                                    {PresetTemplates.map(({title, template}) => (
                                        <RHSHomeTemplate
                                            key={title}
                                            title={title}
                                            template={template}
                                            onUse={newPlaybook}
                                        />
                                    ))}
                                </ListSection>
                            </>
                        )}
                    </Scrollbars>
                </RHSContent>
            </RHSContainer>
        </>
    );
};

export default RHSHome;
