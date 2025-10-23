// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {BookOutlineIcon, FlagOutlineIcon, PencilOutlineIcon} from '@mattermost/compass-icons/components';

import {
    usePlaybooksRouting,
    useRun,
    useRunFollowers,
    useRunMetadata,
} from 'src/hooks';
import LeftChevron from 'src/components/assets/icons/left_chevron';
import FollowButton from 'src/components/backstage/follow_button';
import ExternalLink from 'src/components/assets/icons/external_link';
import {pluginUrl} from 'src/browser_routing';
import {OVERLAY_DELAY} from 'src/constants';
import {finishRun, openUpdateRunNameModal} from 'src/actions';
import {useUpdateRun} from 'src/graphql/hooks';
import DotMenu, {TitleButton} from 'src/components/dot_menu';
import {StyledDropdownMenuItem} from 'src/components/backstage/shared';
import {Separator} from 'src/components/backstage/playbook_runs/shared';
import {playbookRunIsActive} from 'src/types/playbook_run';
import {restoreRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import {ChecklistItemState, newChecklistItem} from 'src/types/playbook';

import {
    RHSTitleButton,
    RHSTitleContainer,
    RHSTitleLink,
    RHSTitleStyledButtonIcon,
} from './rhs_title_common';

interface Props {
    onBackClick: () => void;
    runID: string;
    runName: string;
    isPlaybookRun: boolean;
}

const RHSRunDetailsTitle = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const playbooksBackstage = usePlaybooksRouting();

    const [metadata] = useRunMetadata(props.runID);
    const followState = useRunFollowers(metadata?.followers || []);
    const updateRun = useUpdateRun(props.runID);
    const [run] = useRun(props.runID);

    const handleUpdateName = (newName: string) => {
        updateRun({name: newName});
    };

    // const handleUpdateChannel = (newChannelId: string) => {
    //     updateRun({channelID: newChannelId});
    // };

    const handleFinishRun = () => {
        if (run) {
            dispatch(finishRun(run.team_id, run.id));
        }
    };

    const handleRestartRun = () => {
        if (!run) {
            return;
        }

        const confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to resume the checklist?'});

        const onConfirm = async () => {
            await restoreRun(run.id);
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm resume checklist'}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Resume checklist'}),
            onConfirm,
            onCancel: () => null,
        })));
    };

    const handleSaveAsPlaybook = () => {
        if (!run) {
            return;
        }

        // Map over checklists to remove IDs and sanitize items
        const sanitizedChecklists = run.checklists.map((checklist) => ({
            title: checklist.title,
            items: checklist.items.map((item) =>
                newChecklistItem(
                    item.title,
                    item.description,
                    item.command,
                    item.state as ChecklistItemState
                )
            ),
        }));

        // Navigate to create new playbook with the run's checklist as a template
        playbooksBackstage.create({
            teamId: run.team_id,
            description: formatMessage({defaultMessage: 'Created from "{runName}"'}, {runName: run.name}),
        }, {
            checklists: sanitizedChecklists,
        });
    };

    const tooltip = (
        <Tooltip id={'view-run-overview'}>
            {formatMessage({defaultMessage: 'Go to overview'})}
        </Tooltip>
    );

    const backTooltip = (
        <Tooltip id={'back-to-checklists'}>
            {formatMessage({defaultMessage: 'Back to checklists'})}
        </Tooltip>
    );

    return (
        <RHSTitleContainer>
            <OverlayTrigger
                placement={'top'}
                delay={OVERLAY_DELAY}
                overlay={backTooltip}
            >
                <RHSTitleButton
                    onClick={props.onBackClick}
                    data-testid='back-button'
                >
                    <LeftChevron/>
                </RHSTitleButton>
            </OverlayTrigger>

            {!props.isPlaybookRun && run && (
                <DotMenu
                    dotMenuButton={RHSTitleDropdownButton}
                    placement='bottom-start'
                    icon={
                        <>
                            <DropdownTitle>{props.runName}</DropdownTitle>
                            <i
                                className={'icon icon-chevron-down'}
                                data-testid='checklistDropdown'
                            />
                        </>
                    }
                >
                    {playbookRunIsActive(run) && (
                        <>
                            <StyledDropdownMenuItem
                                onClick={() => dispatch(openUpdateRunNameModal(props.runID, handleUpdateName))}
                            >
                                <PencilOutlineIcon size={18}/>
                                <FormattedMessage defaultMessage='Rename'/>
                            </StyledDropdownMenuItem>
                            {/* <StyledDropdownMenuItem
                                onClick={() => dispatch(openUpdateRunChannelModal(props.runID, run.team_id, PlaybookRunType.ChannelChecklist, handleUpdateChannel))}
                            >
                                <LinkVariantIcon size={18}/>
                                <FormattedMessage defaultMessage='Move checklist to a different channel'/>
                            </StyledDropdownMenuItem> */}
                        </>
                    )}
                    <StyledDropdownMenuItem
                        onClick={handleSaveAsPlaybook}
                    >
                        <BookOutlineIcon size={18}/>
                        <FormattedMessage defaultMessage='Save as playbook'/>
                    </StyledDropdownMenuItem>
                    <Separator/>
                    {playbookRunIsActive(run) ? (
                        <StyledDropdownMenuItem
                            onClick={handleFinishRun}
                        >
                            <FlagOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='Finish'/>
                        </StyledDropdownMenuItem>
                    ) : (
                        <StyledDropdownMenuItem
                            onClick={handleRestartRun}
                            className='restartRun'
                        >
                            <FlagOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='Resume'/>
                        </StyledDropdownMenuItem>
                    )}
                </DotMenu>
            )}
            {props.isPlaybookRun && (
                <OverlayTrigger
                    placement={'top'}
                    delay={OVERLAY_DELAY}
                    overlay={tooltip}
                >
                    <RHSTitleLink
                        data-testid='rhs-title'
                        role={'button'}
                        to={pluginUrl(`/runs/${props.runID}?from=channel_rhs_title`)}
                    >
                        {formatMessage({defaultMessage: 'Run details'})}
                        <RHSTitleStyledButtonIcon>
                            <ExternalLink/>
                        </RHSTitleStyledButtonIcon>
                    </RHSTitleLink>
                </OverlayTrigger>
            )}
            {props.isPlaybookRun &&
            <FollowingWrapper>
                <FollowButton
                    runID={props.runID}
                    followState={metadata ? followState : undefined}
                />
            </FollowingWrapper>
            }
        </RHSTitleContainer>
    );
};

const FollowingWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;

    /* override default styles */
    .unfollowButton {
        border: 0;
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    .followButton {
        border: 0;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }
    }
`;

const RHSTitleDropdownButton = styled(TitleButton)`
    font-family: Metropolis, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);
    padding: 0 4px;
    border-radius: 4px;

    i {
        font-size: 18px;
    }

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

const DropdownTitle = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export default RHSRunDetailsTitle;
