// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import {useSelector} from 'react-redux';
import {General} from 'mattermost-webapp/packages/mattermost-redux/src/constants';

import GenericModal from 'src/components/widgets/generic_modal';
import CheckboxInput from '../../runs_list/checkbox_input';
import {PlaybookRun} from 'src/types/playbook_run';
import {useChannel} from 'src/hooks';
import {isCurrentUserChannelMember} from 'src/selectors';

interface Props {
    playbookRun: PlaybookRun;
    show: boolean;
    hideModal: () => void;
}

const BecomeParticipantsModal = ({playbookRun, show, hideModal}: Props) => {
    const {formatMessage} = useIntl();

    const [forceAddToChannel, setForceAddToChannel] = useState(false);

    const [channel, meta] = useChannel(playbookRun.channel_id);
    const isChannelMember = useSelector(isCurrentUserChannelMember(playbookRun.channel_id));
    const isPrivateChannelWithAccess = meta.error === null && channel?.type === General.PRIVATE_CHANNEL;
    const isPublicChannel = meta.error === null && channel?.type === General.OPEN_CHANNEL;

    const renderExtraMsg = () => {
        if (playbookRun.create_channel_member_on_new_participant) {
            return (
                <ExtraInfoContainer>
                    <LightningBoltOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                    {formatMessage({defaultMessage: 'You’ll also be added to the channel linked to this run.'})}
                </ExtraInfoContainer>
            );
        }

        // no extra info if already a channel member
        if (isChannelMember || isPrivateChannelWithAccess) {
            return null;
        }

        const text = isPublicChannel ? formatMessage({defaultMessage: 'Also add me to the channel linked to this run'}) : formatMessage({defaultMessage: 'Request access to the channel linked to this run'});
        if (isChannelMember || isPrivateChannelWithAccess) {
            return (
                <StyledCheckboxInput
                    testId={'also-add-to-channel'}
                    text={text}
                    checked={forceAddToChannel}
                    onChange={(checked) => setForceAddToChannel(checked)}
                />
            );
        }
        return null;
    };

    const header = (
        <Header>
            {formatMessage({defaultMessage: 'Become a participant'})}
        </Header>
    );

    const onConfirm = () => {
        hideModal();
    };

    return (
        <GenericModal
            id={'become-participant-modal'}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            confirmButtonText={formatMessage({defaultMessage: 'Participate'})}
            showCancel={true}
            handleConfirm={onConfirm}

            onExited={() => {
                setForceAddToChannel(false);
            }}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            components={{
                Header: ModalHeader,
                FooterContainer: StyledFooterContainer,
            }}
        >
            <Body>
                {formatMessage({defaultMessage: 'As a participant, you’ll be able to update the run summary, check off tasks, post status updates and edit the retrospective.'})}
                {renderExtraMsg()}
            </Body>

        </GenericModal>
    );
};

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 16px;
    }
    display: contents;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    margin-top: 20px;
    margin-left: auto;
    margin-right: auto;
    font-size: 22px;
`;

const Body = styled.div`
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    text-align: center;
`;

const StyledFooterContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
`;

const ExtraInfoContainer = styled.div`
    display: flex;
    flex-direction: row;

    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-top: 12px;
    align-items: center;
`;

export const TriggersContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 16px;
`;

export const ActionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 20px;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    padding: 10px 16px 10px 0;
    margin-right: auto;
    white-space: normal;

    &:hover {
        background-color: transparent;
    }
`;

export default BecomeParticipantsModal;
