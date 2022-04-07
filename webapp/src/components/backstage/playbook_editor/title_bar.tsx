// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {HTMLAttributes} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline} from '@mdi/js';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Client4} from 'mattermost-redux/client';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentUserId, getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {FormattedMessage, useIntl} from 'react-intl';

import {navigateToUrl, navigateToPluginUrl} from 'src/browser_routing';
import {useHasPlaybookPermission} from 'src/hooks';
import {useToasts} from '../toast_banner';

import {
    duplicatePlaybook as clientDuplicatePlaybook,
    autoFollowPlaybook,
    autoUnfollowPlaybook,
    telemetryEventForPlaybook,
    playbookExportProps,
    archivePlaybook,
    createPlaybookRun,
} from 'src/client';
import {OVERLAY_DELAY} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {PrimaryButton} from 'src/components/assets/buttons';
import {RegularHeading} from 'src/styles/headings';
import CheckboxInput from '../runs_list/checkbox_input';
import {SecondaryButtonLargerRight} from '../playbook_runs/shared';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';

import {displayEditPlaybookAccessModal} from 'src/actions';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import DotMenu, {DropdownMenuItem, DropdownMenuItemStyled} from 'src/components/dot_menu';
import useConfirmPlaybookArchiveModal from '../archive_playbook_modal';
import {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip/hooks';
import {PlaybookPreviewTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';
import TutorialTourTip from 'src/components/tutorial/tutorial_tour_tip';

const LEARN_PLAYBOOKS_TITLE = 'Learn how to use playbooks';

const MembersIcon = styled.div`
    display: inline-block;
    font-size: 12px;
    border-radius: 4px;
    padding: 0 8px;
    font-weight: 600;
    margin: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    height: 28px;
    line-height: 28px;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const TitleButton = styled.div`
    margin-left: 20px;
    display: inline-flex;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    fill: rgba(var(--center-channel-color-rgb), 0.64);

    &:hover {
        background: rgba(var(--link-color-rgb), 0.08);
        color: rgba(var(--link-color-rgb), 0.72);
    }
`;

const RedText = styled.div`
    color: var(--error-text);
`;

type Props = {
    playbook: PlaybookWithChecklist;
    isFollowing: boolean;
    onFollowingChange: (following: boolean) => void;
}

type Attrs = HTMLAttributes<HTMLElement>;

const TitleBar = ({
    playbook,
    isFollowing,
    onFollowingChange,
    ...attrs
}: Props & Attrs) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const currentUserId = useSelector(getCurrentUserId);
    const currentUser = useSelector(getCurrentUser);
    const [modal, openDeletePlaybookModal] = useConfirmPlaybookArchiveModal(() => {
        if (playbook) {
            archivePlaybook(playbook.id);
            navigateToPluginUrl('/playbooks');
        }
    });
    const {add: addToast} = useToasts();
    const punchoutTitleRow = useMeasurePunchouts(['title-row'], [], {y: -5, height: 10, x: -5, width: 10});
    const showRunButtonTutorial = useShowTutorialStep(PlaybookPreviewTutorialSteps.RunButton, TutorialTourCategories.PLAYBOOK_PREVIEW);

    const changeFollowing = (following: boolean) => {
        if (playbook?.id && following !== isFollowing) {
            if (following) {
                autoFollowPlaybook(playbook.id, currentUserId);
            } else {
                autoUnfollowPlaybook(playbook.id, currentUserId);
            }
            onFollowingChange(following);
        }
    };

    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);

    const isTutorialPlaybook = playbook?.title === LEARN_PLAYBOOKS_TITLE;

    const goToPlaybooks = () => {
        navigateToPluginUrl('/playbooks');
    };

    const runPlaybook = async () => {
        if (playbook && isTutorialPlaybook) {
            const playbookRun = await createPlaybookRun(playbook.id, currentUserId, playbook.team_id, `${currentUser.username}'s onboarding run`, playbook.description);
            const channel = await Client4.getChannel(playbookRun.channel_id);
            const pathname = `/${team.name}/channels/${channel.name}`;
            const search = '?forceRHSOpen&openTakeATourDialog';
            navigateToUrl({pathname, search});
            return;
        }
        if (playbook?.id) {
            telemetryEventForPlaybook(playbook.id, 'playbook_dashboard_run_clicked');
            navigateToUrl(`/${team.name || ''}/_playbooks/${playbook?.id || ''}/run`);
        }
    };

    let accessIconClass;
    if (playbook.public) {
        accessIconClass = 'icon-globe';
    } else {
        accessIconClass = 'icon-lock-outline';
    }

    let toolTipText = formatMessage({defaultMessage: 'Select this to automatically receive updates when this playbook is run.'});
    if (isFollowing) {
        toolTipText = formatMessage({defaultMessage: 'You automatically receive updates when this playbook is run.'});
    }

    const tooltip = (
        <Tooltip id={`auto-follow-tooltip-${isFollowing}`}>
            {toolTipText}
        </Tooltip>
    );

    const archived = playbook?.delete_at !== 0;
    const enableRunPlaybook = !archived && hasPermissionToRunPlaybook;
    const [exportHref, exportFilename] = playbookExportProps(playbook);

    return (
        <TopContainer
            {...attrs}
            id='title-row'
        >
            <Header>
                <LeftArrow
                    className='icon-arrow-left'
                    onClick={goToPlaybooks}
                />
                <DotMenu
                    dotMenuButton={TitleButton}
                    left={true}
                    icon={
                        <>
                            <i className={'icon ' + accessIconClass}/>
                            <Title>{playbook.title}</Title>
                            <i className={'icon icon-chevron-down'}/>
                        </>
                    }
                >
                    <DropdownMenuItem
                        onClick={() => dispatch(displayEditPlaybookAccessModal(playbook.id))}
                    >
                        <FormattedMessage defaultMessage='Manage access'/>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={async () => {
                            const newID = await clientDuplicatePlaybook(playbook.id);
                            navigateToPluginUrl(`/playbooks/${newID}`);
                            addToast(formatMessage({defaultMessage: 'Successfully duplicated playbook'}));
                            telemetryEventForPlaybook(playbook.id, 'playbook_duplicate_clicked_in_playbook');
                        }}
                    >
                        <FormattedMessage defaultMessage='Duplicate'/>
                    </DropdownMenuItem>
                    <DropdownMenuItemStyled
                        href={exportHref}
                        download={exportFilename}
                        role={'button'}
                        onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_export_clicked_in_playbook')}
                    >
                        <FormattedMessage defaultMessage='Export'/>
                    </DropdownMenuItemStyled>
                    {!archived &&
                    <DropdownMenuItem
                        onClick={() => openDeletePlaybookModal(playbook)}
                    >
                        <RedText>
                            <FormattedMessage defaultMessage='Archive playbook'/>
                        </RedText>
                    </DropdownMenuItem>
                    }
                </DotMenu>
                <MembersIcon onClick={() => dispatch(displayEditPlaybookAccessModal(playbook.id))}>
                    <i className={'icon icon-account-multiple-outline'}/>
                    {playbook.members.length}
                </MembersIcon>
                {archived && (
                    <StatusBadge
                        data-testid={'archived-badge'}
                        status={BadgeType.Archived}
                    />
                )}
                <SecondaryButtonLargerRightStyled
                    checked={isFollowing}
                    disabled={archived}
                >
                    <OverlayTrigger
                        placement={'bottom'}
                        delay={OVERLAY_DELAY}
                        overlay={tooltip}
                    >
                        <div>
                            <CheckboxInputStyled
                                testId={'auto-follow-runs'}
                                text={'Auto-follow runs'}
                                checked={isFollowing}
                                disabled={archived}
                                onChange={changeFollowing}
                            />
                        </div>
                    </OverlayTrigger>
                </SecondaryButtonLargerRightStyled>
                <PrimaryButtonLarger
                    onClick={runPlaybook}
                    disabled={!enableRunPlaybook}
                    title={enableRunPlaybook ? formatMessage({defaultMessage: 'Run Playbook'}) : formatMessage({defaultMessage: 'You do not have permissions'})}
                    data-testid='run-playbook'
                >
                    <RightMarginedIcon
                        path={mdiClipboardPlayOutline}
                        size={1.25}
                    />
                    {isTutorialPlaybook ? formatMessage({defaultMessage: 'Start a test run'}) : formatMessage({defaultMessage: 'Run'})}
                </PrimaryButtonLarger>
                {showRunButtonTutorial && (
                    <TutorialTourTip
                        {...isTutorialPlaybook ? {
                            title: formatMessage({defaultMessage: 'Test your new playbook out!'}),
                            screen: formatMessage({defaultMessage: 'Select <strong>Start a test run</strong> to see it in action.'}, {strong: (x) => <strong>{x}</strong>}),
                        } : {
                            title: formatMessage({defaultMessage: 'Ready run to your playbook?'}),
                            screen: formatMessage({defaultMessage: 'Select <strong>Run</strong> to see it in action.'}, {strong: (x) => <strong>{x}</strong>}),
                        }}
                        tutorialCategory={TutorialTourCategories.PLAYBOOK_PREVIEW}
                        step={PlaybookPreviewTutorialSteps.RunButton}
                        placement='bottom-end'
                        pulsatingDotPlacement='right'
                        pulsatingDotTranslate={{x: -90, y: 15}}
                        autoTour={true}
                        width={352}
                        punchOut={punchoutTitleRow}
                        telemetryTag={`tutorial_tip_Playbook_Preview_${PlaybookPreviewTutorialSteps.RunButton}_RunButton`}
                    />
                )}
            </Header>

            {modal}
        </TopContainer>
    );
};

const LeftArrow = styled.button`
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 36px;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;
const Title = styled.div`
    ${RegularHeading} {
    }

    font-size: 20px;
    line-height: 28px;
    height: 28px;
    color: var(--center-channel-color);
    margin-left: 6px;
    margin-right: 6px;
`;

const PrimaryButtonLarger = styled(PrimaryButton)`
    padding: 0 16px;
    height: 36px;
    margin-left: 12px;
`;

const CheckboxInputStyled = styled(CheckboxInput)`
    padding-right: 4px;
    padding-left: 4px;
    font-size: 14px;

    &:hover {
        background-color: transparent;
    }
`;

const SecondaryButtonLargerRightStyled = styled(SecondaryButtonLargerRight) <{checked: boolean}>`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover:enabled {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({checked}) => checked && css`
        border: 1px solid var(--button-bg);
        color: var(--button-bg);

        &:hover:enabled {
            background-color: rgba(var(--button-bg-rgb), 0.12);
        }
    `}
`;

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
    height: 100%;
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    padding: 0 32px;
    height: 100%;
`;

const RightMarginedIcon = styled(Icon)`
    margin-right: 0.5rem;
`;

export default styled(TitleBar)``;
