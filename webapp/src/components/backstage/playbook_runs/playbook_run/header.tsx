// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {joinChannel} from 'mattermost-redux/actions/channels';

import {PrimaryButton} from 'src/components/assets/buttons';
import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {getSiteUrl, requestGetInvolved} from 'src/client';
import {useChannel} from 'src/hooks';
import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';

import {Role, Badge, ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {navigateToUrl} from 'src/browser_routing';

import {BadgeType} from '../../status_badge';
import {ToastType, useToasts} from '../../toast_banner';

import {ContextMenu} from './context_menu';
import HeaderButton from './header_button';

interface Props {
    playbookRun: PlaybookRun;
    playbookRunMetadata: PlaybookRunMetadata | null;
    role: Role;
    onViewInfo: () => void;
    onViewTimeline: () => void;
}

export const RunHeader = ({playbookRun, playbookRunMetadata, role, onViewInfo, onViewTimeline}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const channel = useChannel(playbookRun.channel_id);
    const addToast = useToasts().add;

    const onGetInvolved = async () => {
        if (role === Role.Participant || !playbookRunMetadata) {
            return;
        }
        if (channel === null) {
            const response = await requestGetInvolved(playbookRun.id);
            if (response?.error) {
                addToast(formatMessage({defaultMessage: 'It was not possible to request to get involved'}), ToastType.Failure);
            } else {
                addToast(formatMessage({defaultMessage: 'Request has been sent to the run channel.'}), ToastType.Success);
            }
        } else {
            await dispatch(joinChannel(currentUserId, playbookRun.team_id, playbookRun.channel_id, playbookRunMetadata.channel_name));
            navigateToChannel();
        }
    };

    const navigateToChannel = () => {
        if (!playbookRunMetadata) {
            return;
        }
        navigateToUrl(`/${playbookRunMetadata.team_name}/channels/${playbookRunMetadata.channel_name}`);
    };

    return (
        <Container data-testid={'run-header-section'}>
            {/* <Icon className={'icon-star'}/> */}
            <ContextMenu
                playbookRun={playbookRun}
                role={role}
            />
            <StyledBadge status={BadgeType[playbookRun.current_status]}/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Run Actions'})}

                //TODO: replace icon to 'icon-lightning-bolt-outline'
                className={'icon-hammer'}
                aria-label={formatMessage({defaultMessage: 'Run Actions'})}
                onClick={() => dispatch(showRunActionsModal())}
                size={24}
                iconSize={14}
            />
            <StyledCopyLink
                id='copy-run-link-tooltip'
                to={getSiteUrl() + '/playbooks/run_details/' + playbookRun?.id}
                tooltipMessage={formatMessage({defaultMessage: 'Copy link to run'})}
            />
            <ExpandRight/>

            {role === Role.Participant &&
                <HeaderButton
                    tooltipId={'go-to-channel-button-tooltip'}
                    tooltipMessage={formatMessage({defaultMessage: 'Go to channel'})}
                    className={'icon-product-channels'}
                    onClick={navigateToChannel}
                />
            }
            <HeaderButton
                tooltipId={'timeline-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Timeline'})}
                className={'icon-update'}
                onClick={onViewTimeline}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Info'})}
                className={'icon-information-outline'}
                onClick={onViewInfo}
            />
            {role === Role.Viewer &&
                <GetInvolved onClick={onGetInvolved}>
                    <GetInvolvedIcon color={'var(--button-color)'}/>
                    {formatMessage({defaultMessage: 'Get involved'})}
                </GetInvolved>
            }
            <RunActionsModal
                playbookRun={playbookRun}
                readOnly={role === Role.Viewer}
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

const Icon = styled.i`
    font-size: 18px;
`;

const StyledCopyLink = styled(CopyLink)`
    border-radius: 4px;
    font-size: 14px;
    width: 24px;
    height: 24px;
    margin-left: 4px;
    display: grid;
    place-items: center;
`;

const StyledBadge = styled(Badge)`
    margin-left: 8px;
    margin-right: 6px;
    text-transform: uppercase;
`;

const GetInvolved = styled(PrimaryButton)`
    height: 28px;
    padding: 0 12px;
`;

const GetInvolvedIcon = styled(AccountPlusOutlineIcon)`
    height: 14px;
    width: 14px;
    margin-right: 3px;
`;
