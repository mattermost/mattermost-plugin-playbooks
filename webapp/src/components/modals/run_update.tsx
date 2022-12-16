// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {ApolloProvider} from '@apollo/client';

import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import GenericModal, {InlineLabel, ModalSubheading} from 'src/components/widgets/generic_modal';
import {BaseInput} from 'src/components/assets/inputs';
import {useRun} from 'src/hooks';
import {useUpdateRun} from 'src/graphql/hooks';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

const ID = 'playbook_run_update';

type Props = {
    playbookRunId: string;
    teamId: string;
    field: 'name' | 'channel_id';
    addToast: (message: string) => void;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: WrappedUpdateRunModal,
    dialogProps: props,
});

const UpdateRunModal = ({
    playbookRunId,
    teamId,
    field,
    addToast,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [channelId, setChannelId] = useState('');
    const [channelName, setChannelName] = useState('');
    const [name, setName] = useState('');
    const [run] = useRun(playbookRunId);
    const updateRun = useUpdateRun(playbookRunId);

    useEffect(() => {
        if (run) {
            setChannelId(run.channel_id);
        }
    }, [run, run?.channel_id]);

    useEffect(() => {
        if (run) {
            setName(run.name);
        }
    }, [run, run?.name]);

    const onSubmit = () => {
        if (field === 'name') {
            updateRun({name});
        }
        if (field === 'channel_id') {
            updateRun({channelID: channelId});
            addToast(formatMessage({defaultMessage: 'Run moved to {channel}'}, {channel: channelName}));
        }
    };

    const isFormValid = () => {
        if (field === 'name') {
            return name !== '' && name !== run?.name;
        }
        return channelId !== '' && channelId !== run?.channel_id;
    };

    const header = (
        <Header>
            {field === 'name' ? formatMessage({defaultMessage: 'Rename run'}) : formatMessage({defaultMessage: 'Link run to a different channel'})}
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
            isConfirmDisabled={!isFormValid()}
            handleConfirm={onSubmit}
            id={ID}
            modalHeaderText={header}
            {...modalProps}
        >
            {field === 'name' && (
                <Body>
                    <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                    <BaseInput
                        data-testid={'run-name-input'}
                        autoFocus={true}
                        type={'text'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </Body>
            )}
            {field === 'channel_id' && (
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
            )}
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

const WrappedUpdateRunModal = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><UpdateRunModal {...props}/></ApolloProvider>;
};

export const StyledChannelSelector = styled(ChannelSelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};
    .playbooks-rselect__control {
        padding: 4px 16px 4px 3.2rem;

        &:before {
            left: 16px;
            top: 8px;
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
