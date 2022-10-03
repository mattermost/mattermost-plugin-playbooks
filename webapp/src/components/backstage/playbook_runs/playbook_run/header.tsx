// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {AccountPlusOutlineIcon, TimelineTextOutlineIcon, InformationOutlineIcon, LightningBoltOutlineIcon, StarOutlineIcon, StarIcon} from '@mattermost/compass-icons/components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {Channel} from '@mattermost/types/channels';

import {PrimaryButton} from 'src/components/assets/buttons';
import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {
    getSiteUrl,
    telemetryEventForPlaybookRun,
} from 'src/client';
import {useFavoriteRun} from 'src/hooks';
import {useRunMembership} from 'src/graphql/hooks';
import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {Role, Badge, ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {PlaybookRunEventTarget} from 'src/types/telemetry';

import {BadgeType} from '../../status_badge';
import {ToastType, useToaster} from '../../toast_banner';
import {RHSContent} from 'src/components/backstage/playbook_runs/playbook_run/rhs';

import {StarButton} from '../../playbook_editor/playbook_editor';

import {ContextMenu} from './context_menu';
import HeaderButton from './header_button';

interface Props {
    playbookRunMetadata: PlaybookRunMetadata | null;
    playbookRun: PlaybookRun;
    role: Role;
    channel: Channel | undefined | null;
    hasPermanentViewerAccess: boolean;
    onInfoClick: () => void;
    onTimelineClick: () => void;
    rhsSection: RHSContent | null;
    isFollowing: boolean;
}

export const RunHeader = ({playbookRun, playbookRunMetadata, isFollowing, hasPermanentViewerAccess, channel, role, onInfoClick, onTimelineClick, rhsSection}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [showGetInvolvedConfirm, setShowGetInvolvedConfirm] = useState(false);
    const currentUserId = useSelector(getCurrentUserId);

    const addToast = useToaster().add;
    const [isFavoriteRun, toggleFavorite] = useFavoriteRun(playbookRun.team_id, playbookRun.id);

    const {addToRun} = useRunMembership(playbookRun.id, [currentUserId]);

    const onParticipate = async () => {
        if (role === Role.Participant || !playbookRunMetadata) {
            return;
        }
        telemetryEventForPlaybookRun(playbookRun.id, PlaybookRunEventTarget.GetInvolvedClick);
        setShowGetInvolvedConfirm(true);
    };

    const onConfirmParticipate = async () => {
        if (role === Role.Participant || !playbookRunMetadata) {
            return;
        }

        addToRun()
            .then(() => addToast(formatMessage({defaultMessage: 'You\'ve joined this run.'}), ToastType.Success))
            .catch(() => addToast(formatMessage({defaultMessage: 'It wasn\'t possible to join the run'}), ToastType.Failure));
        telemetryEventForPlaybookRun(playbookRun.id, PlaybookRunEventTarget.GetInvolvedJoin);
    };

    const confirmGetInvolvedMessage = () => {
        const commonMessage = formatMessage({defaultMessage: 'As a participant, you can post status updates, assign and complete tasks, and perform retrospectives.'});
        const introMessage = channel === null ? formatMessage({defaultMessage: 'Request to participate in this run.'}) : formatMessage({defaultMessage: 'Become a participant of the run.'});
        return introMessage + ' ' + commonMessage;
    };

    // Favorite Button State
    const FavoriteIcon = isFavoriteRun ? StarIcon : StarOutlineIcon;

    return (
        <Container data-testid={'run-header-section'}>
            <StarButton onClick={toggleFavorite}>
                <FavoriteIcon
                    size={18}
                    color={isFavoriteRun ? 'var(--sidebar-text-active-border)' : 'var(--center-channel-color-56)'}
                />
            </StarButton>
            <ContextMenu
                playbookRun={playbookRun}
                role={role}
                isFavoriteRun={isFavoriteRun}
                isFollowing={isFollowing}
                toggleFavorite={toggleFavorite}
                hasPermanentViewerAccess={hasPermanentViewerAccess}
            />
            <StyledBadge status={BadgeType[playbookRun.current_status]}/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Run Actions'})}
                aria-label={formatMessage({defaultMessage: 'Run Actions'})}
                Icon={LightningBoltOutlineIcon}
                onClick={() => dispatch(showRunActionsModal())}
                data-testid={'rhs-header-button-run-actions'}
            />
            <StyledCopyLink
                id='copy-run-link-tooltip'
                to={getSiteUrl() + '/playbooks/runs/' + playbookRun?.id}
                tooltipMessage={formatMessage({defaultMessage: 'Copy link to run'})}
            />
            <ExpandRight/>
            <HeaderButton
                tooltipId={'timeline-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Timeline'})}
                Icon={TimelineTextOutlineIcon}
                onClick={onTimelineClick}
                isActive={rhsSection === RHSContent.RunTimeline}
                data-testid={'rhs-header-button-timeline'}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Info'})}
                Icon={InformationOutlineIcon}
                onClick={onInfoClick}
                isActive={rhsSection === RHSContent.RunInfo}
                data-testid={'rhs-header-button-info'}
            />
            {role === Role.Viewer &&
                <GetInvolved onClick={onParticipate}>
                    <GetInvolvedIcon color={'var(--button-color)'}/>
                    {formatMessage({defaultMessage: 'Participate'})}
                </GetInvolved>
            }
            <RunActionsModal
                playbookRun={playbookRun}
                readOnly={role === Role.Viewer}
            />
            <ConfirmModal
                show={showGetInvolvedConfirm}
                title={formatMessage({defaultMessage: 'Participate in the run'})}
                message={confirmGetInvolvedMessage()}
                confirmButtonText={formatMessage({defaultMessage: 'Confirm'})}
                onConfirm={() => {
                    onConfirmParticipate();
                    setShowGetInvolvedConfirm(false);
                }}
                onCancel={() => setShowGetInvolvedConfirm(false)}
            />
        </Container>
    );
};

const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 14px 0 20px;

    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
`;

const StyledCopyLink = styled(CopyLink)`
    border-radius: 4px;
    font-size: 18px;
    width: 28px;
    height: 28px;
    margin-left: 4px;
    display: grid;
    place-items: center;
`;

const StyledBadge = styled(Badge)`
    margin-left: 8px;
    margin-right: 6px;
    text-transform: uppercase;
    font-size: 10px;
    padding: 2px 6px;
    line-height: 16px;
`;

const GetInvolved = styled(PrimaryButton)`
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    margin-left: 8px;
`;

const GetInvolvedIcon = styled(AccountPlusOutlineIcon)`
    height: 14px;
    width: 14px;
    margin-right: 3px;
`;
