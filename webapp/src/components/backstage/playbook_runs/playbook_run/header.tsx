// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {getSiteUrl} from 'src/client';
import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';
import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';

import {ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {navigateToUrl} from 'src/browser_routing';

import {ContextMenu} from './context_menu';

interface HeaderProps {
    playbookRun: PlaybookRun;
    playbookRunMetadata: PlaybookRunMetadata | null
}

export const HeaderContainer = ({playbookRun, playbookRunMetadata}: HeaderProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <Container>
            <Icon className={'icon-star'}/>
            <ContextMenu playbookRun={playbookRun}/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Run Actions'})}
                className={'icon-lightning-bolt-outline'}
                onClick={() => dispatch(showRunActionsModal())}
            />
            <StyledCopyLink
                id='copy-run-link-tooltip'
                to={getSiteUrl() + '/playbooks/runs/' + playbookRun?.id}
                tooltipMessage={formatMessage({defaultMessage: 'Copy link to run'})}
            />
            <ExpandRight/>

            <HeaderButton
                tooltipId={'go-to-channel-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Go to channel'})}
                className={'icon-product-channels'}
                onClick={() => {
                    if (!playbookRunMetadata) {
                        return;
                    }
                    navigateToUrl(`/${playbookRunMetadata.team_name}/channels/${playbookRunMetadata.channel_name}`);
                }}
            />
            <HeaderButton
                tooltipId={'timeline-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Timeline'})}
                className={'icon-lightning-bolt-outline'}
                onClick={() => {}}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Info'})}
                className={'󰋽 icon-information-outline'}
                onClick={() => {}}
            />
            <RunActionsModal playbookRun={playbookRun}/>
        </Container>
    );
};

const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;

    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
`;

const Icon = styled.i`
    font-size: 18px;
`;

const StyledCopyLink = styled(CopyLink)`
    border-radius: 4px;
    font-size: 16px;
    width: 28px;
    height: 28px;
    line-height: 18px;
    margin-left: 8px;
    display: grid;
    place-items: center;
`;

interface HeaderButtonProps {
    tooltipId: string;
    tooltipMessage: string
    className: string;
    onClick: () => void;
    clicked?: boolean;
}

const HeaderButton = ({tooltipId, tooltipMessage, className, onClick, clicked}: HeaderButtonProps) => {
    return (
        <Tooltip
            id={tooltipId}
            placement={'bottom'}
            shouldUpdatePosition={true}
            content={tooltipMessage}
        >
            <HeaderIcon
                onClick={() => onClick()}
                clicked={clicked ?? false}
            >

                <Icon className={className}/>

            </HeaderIcon>
        </Tooltip>
    );
};
