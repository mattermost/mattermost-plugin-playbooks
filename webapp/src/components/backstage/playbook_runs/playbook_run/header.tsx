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

import {Badge, ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {navigateToUrl} from 'src/browser_routing';
import {BadgeType} from '../../status_badge';

import {ContextMenu} from './context_menu';
import HeaderButton from './header_button';
import {RHSContent} from './rhs';

interface Props {
    playbookRun: PlaybookRun;
    playbookRunMetadata: PlaybookRunMetadata | null
    openRHS: (section: RHSContent, title: React.ReactNode, subtitle?: React.ReactNode) => void
}

export const RunHeader = ({playbookRun, playbookRunMetadata, openRHS}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <Container>
            {/* <Icon className={'icon-star'}/> */}
            <ContextMenu playbookRun={playbookRun}/>
            <StyledBadge status={BadgeType[playbookRun.current_status]}/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'Run Actions'})}

                //TODO: replace icon to 'icon-lightning-bolt-outline'
                className={'icon-hammer'}
                onClick={() => dispatch(showRunActionsModal())}
                size={24}
                iconSize={14}
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
                className={'icon-update'}
                onClick={() => openRHS(RHSContent.RunTimeline, formatMessage({defaultMessage: 'Timeline'}), playbookRun.name)}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipMessage={formatMessage({defaultMessage: 'View Info'})}
                className={'icon-information-outline'}
                onClick={() => openRHS(RHSContent.RunInfo, formatMessage({defaultMessage: 'Run info'}), playbookRun.name)}
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
`;
