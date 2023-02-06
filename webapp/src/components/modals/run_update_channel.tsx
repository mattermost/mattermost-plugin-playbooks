// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import GenericModal, {InlineLabel, ModalSubheading} from 'src/components/widgets/generic_modal';
import {useRun} from 'src/hooks';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {useToaster} from 'src/components/backstage/toast_banner';
import {useUpdateRun} from 'src/graphql/hooks';

import {currentPlaybookRun} from 'src/selectors';
import {removedFromPlaybookRunChannel} from 'src/actions';
import {ToastStyle} from 'src/components/backstage/toast';

const ID = 'playbook_run_update';

type Props = {
    playbookRunId: string;
    teamId: string;
    onSubmit: (newChannelId: string, newChannelName: string) => void;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunModal,
    dialogProps: props,
});

const UpdateRunModal = ({
    playbookRunId,
    teamId,
    onSubmit,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [channelId, setChannelId] = useState('');
    const [channelName, setChannelName] = useState('');
    const [run] = useRun(playbookRunId);
    const isPlaybookRun = run?.type === PlaybookRunType.Playbook;

    useEffect(() => {
        if (run) {
            setChannelId(run.channel_id);
        }
    }, [run, run?.channel_id]);

    const header = (
        <Header>
            {isPlaybookRun ? formatMessage({defaultMessage: 'Link run to a different channel'}) : formatMessage({defaultMessage: 'Link checklist to a different channel'})}
            <ModalSubheading>
                {run?.name}
            </ModalSubheading>
        </Header>
    );

    return (
        <StyledGenericModal
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            showCancel={true}
            isConfirmDisabled={!(channelId !== '' && channelId !== run?.channel_id)}
            handleConfirm={() => onSubmit(channelId, channelName)}
            id={ID}
            modalHeaderText={
                <Header>
                    {isPlaybookRun ? formatMessage({defaultMessage: 'Link run to a different channel'}) : formatMessage({defaultMessage: 'Link checklist to a different channel'})}
                    <ModalSubheading>
                        {run?.name}
                    </ModalSubheading>
                </Header>
            }
            {...modalProps}
        >
            <Body>
                <InlineLabel>{formatMessage({defaultMessage: 'Select channel'})}</InlineLabel>
                <StyledChannelSelector
                    id={'link_existing_channel_selector'}
                    onChannelSelected={(channel_id: string, channel_name: string) => {
                        setChannelId(channel_id);
                        setChannelName(channel_name);
                    }}
                    channelIds={[channelId]}
                    isClearable={false}
                    selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                    isDisabled={false}
                    captureMenuScroll={false}
                    shouldRenderValue={true}
                    teamId={teamId}
                    isMulti={false}
                />
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }
        .modal-header {
            padding: 24px 31px 5px 31px;
            margin-bottom: 0;
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 10px 31px;
        }
        .modal-footer {
           padding: 0 31px 28px 31px;
        }
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

export const StyledChannelSelector = styled(ChannelSelector)`

    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};
    .playbooks-rselect__control {
        padding: 4px 16px 4px 3.2rem;
        height: 48px;
        &:before {
            left: 16px;
            top: 13px;
            position: absolute;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;

export const useUpdateRunChannel = (id: string) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    const [run] = useRun(id);
    const updateRun = useUpdateRun(id);
    const currentRun = useSelector(currentPlaybookRun);
    const channelId = useSelector(getCurrentChannelId);

    const isPlaybookRun = run?.type === PlaybookRunType.Playbook;

    return async (newChannelId: string, newChannelName: string) => {
        await updateRun({channelID: newChannelId});

        // Remove old reference to run in state tree if there is one
        if (currentRun && currentRun.id === run?.id) {
            dispatch(removedFromPlaybookRunChannel(channelId));
        }

        addToast({
            content: isPlaybookRun ? formatMessage({defaultMessage: 'Run moved to {channel}'}, {channel: newChannelName}) : formatMessage({defaultMessage: 'Checklist moved to {channel}'}, {channel: newChannelName}),
            toastStyle: ToastStyle.Success,
        });
    };
};
