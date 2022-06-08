// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {getSiteUrl} from 'src/client';
import {TitleButton} from '../../playbook_editor/controls';
import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';

import {ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {navigateToUrl} from 'src/browser_routing';

interface HeaderProps {
    playbookRun: PlaybookRun;
    playbookRunMetadata: PlaybookRunMetadata | null
}

export const HeaderContainer = ({playbookRun, playbookRunMetadata}: HeaderProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    // const {add: addToast} = useToasts();

    return (
        <Container>
            <Icon className={'icon-star'}/>
            <TitleMenuImpl/>
            <HeaderButton
                tooltipId={'run-actions-button-tooltip'}
                tooltipContent={formatMessage({defaultMessage: 'Run Actions'})}
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
                tooltipContent={formatMessage({defaultMessage: 'Go to channel'})}
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
                tooltipContent={formatMessage({defaultMessage: 'View Timeline'})}
                className={'icon-lightning-bolt-outline'}
                onClick={() => {}}
            />
            <HeaderButton
                tooltipId={'info-button-tooltip'}
                tooltipContent={formatMessage({defaultMessage: 'View Info'})}
                className={'󰋽 icon-information-outline'}
                onClick={() => {}}
            />
            <RunActionsModal playbookRun={playbookRun}/>
        </Container>
    );
};

interface TitleMenuProps {
    playbookRun?: PlaybookRun;
    className?: string;
}

const TitleMenuImpl = ({playbookRun, className}: TitleMenuProps) => {
    // const dispatch = useDispatch();
    // const {formatMessage} = useIntl();
    // const [confirmRestoreModal, openConfirmRestoreModal] = useConfirmPlaybookRestoreModal();

    // const {add: addToast} = useToasts();

    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                placement='bottom-end'
                icon={
                    <>
                        <Title>{'Run title'}</Title>
                        <i className={'icon icon-chevron-down'}/>
                    </>
                }
            >
                <DropdownMenuItem
                    onClick={() => {}}
                >
                    <FormattedMessage defaultMessage='Manage access'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {}}
                >
                    <FormattedMessage defaultMessage='Rename'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={async () => {}}
                >
                    <FormattedMessage defaultMessage='Duplicate'/>
                </DropdownMenuItem>
            </DotMenu>
        </>
    );
};

export const TitleMenu = styled(TitleMenuImpl)`

`;

const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;

    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
`;

const Title = styled.div`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    margin: 0;
    white-space: nowrap;
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
    tooltipContent: string
    className: string;
    onClick: () => void;
}

const HeaderButton = ({tooltipId, tooltipContent, onClick, className}: HeaderButtonProps) => {
    return (
        <Tooltip
            id={tooltipId}
            placement={'bottom'}
            shouldUpdatePosition={true}
            content={tooltipContent}
        >
            <HeaderIcon
                onClick={() => onClick()}
                clicked={false}
            >

                <Icon className={className}/>

            </HeaderIcon>
        </Tooltip>
    );
};
