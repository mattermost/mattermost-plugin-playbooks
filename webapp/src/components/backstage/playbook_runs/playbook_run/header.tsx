// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {UpdateIcon, InformationOutlineIcon, LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {getSiteUrl} from 'src/client';
import {PlaybookRun} from 'src/types/playbook_run';

import {Role, Badge, ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {BadgeType} from '../../status_badge';

import {ContextMenu} from './context_menu';
import HeaderButton from './header_button';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    onViewInfo: () => void;
    onViewTimeline: () => void;
}

export const RunHeader = ({playbookRun, role, onViewInfo, onViewTimeline}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <Container data-testid={'run-header-section'}>
            <ContextMenu
                playbookRun={playbookRun}
                role={role}
            />
            <StyledBadge status={BadgeType[playbookRun.current_status]}/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Run Actions'})}
                aria-label={formatMessage({defaultMessage: 'Run Actions'})}
                Icon={LightningBoltOutlineIcon}
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
            <HeaderButton
                tooltipId={'timeline-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Timeline'})}
                Icon={UpdateIcon}
                onClick={onViewTimeline}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Info'})}
                Icon={InformationOutlineIcon}
                onClick={onViewInfo}
            />
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
    font-size: 10px;
    padding: 2px 6px;
    line-height: 16px;
`;
