// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';

import CopyLink from 'src/components/widgets/copy_link';
import {showRunActionsModal} from 'src/actions';
import {exportChannelUrl, finishRun, getSiteUrl} from 'src/client';
import {TitleButton} from '../../playbook_editor/controls';
import {PlaybookRun, Metadata as PlaybookRunMetadata} from 'src/types/playbook_run';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';

import {ExpandRight} from 'src/components/backstage/playbook_runs/shared';
import RunActionsModal from 'src/components/run_actions_modal';
import {navigateToUrl} from 'src/browser_routing';
import {copyToClipboard} from 'src/utils';
import {useToasts} from '../../toast_banner';
import {useAllowChannelExport} from 'src/hooks';
import UpgradeModal from '../../upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {outstandingTasks} from 'src/components/modals/update_run_status_modal';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

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
            <TitleMenuImpl playbookRun={playbookRun}/>
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

interface TitleMenuProps {
    playbookRun: PlaybookRun;
}

const TitleMenuImpl = ({playbookRun}: TitleMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToasts();

    //@ts-ignore plugins state is a thing
    const exportAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
    const allowChannelExport = useAllowChannelExport();
    const [showModal, setShowModal] = useState(false);

    const onExportClick = () => {
        if (!allowChannelExport) {
            setShowModal(true);
            return;
        }

        window.location.href = exportChannelUrl(playbookRun.channel_id);
    };

    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                placement='bottom-end'
                icon={
                    <>
                        <Title>{playbookRun.name}</Title>
                        <i className={'icon icon-chevron-down'}/>
                    </>
                }
            >
                <DropdownMenuItem
                    onClick={() => {
                        copyToClipboard(getSiteUrl() + '/playbooks/runs/' + playbookRun?.id);
                        addToast(formatMessage({defaultMessage: 'Copied!'}));
                    }}
                >
                    <FormattedMessage defaultMessage='Copy link'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => dispatch(showRunActionsModal())}
                >
                    <FormattedMessage defaultMessage='Run actions'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!exportAvailable}
                    disabledAltText={formatMessage({defaultMessage: 'Install and enable the Channel Export plugin to support exporting the channel'})}
                    onClick={async () => {
                        onExportClick();
                    }}
                >
                    <FormattedMessage defaultMessage='Export channel log'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        const outstanding = outstandingTasks(playbookRun.checklists);
                        let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish the run?'});
                        if (outstanding > 0) {
                            confirmationMessage = formatMessage(
                                {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish the run?'},
                                {outstanding});
                        }

                        const onConfirm = () => {
                            finishRun(playbookRun.id);
                        };

                        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                            show: true,
                            title: formatMessage({defaultMessage: 'Confirm finish run'}),
                            message: confirmationMessage,
                            confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
                            onConfirm,
                            // eslint-disable-next-line @typescript-eslint/no-empty-function
                            onCancel: () => {},
                        })));
                    }}
                >
                    <FormattedMessage defaultMessage='Finish run'/>
                </DropdownMenuItem>
            </DotMenu>
            <UpgradeModal
                messageType={AdminNotificationType.EXPORT_CHANNEL}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
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
