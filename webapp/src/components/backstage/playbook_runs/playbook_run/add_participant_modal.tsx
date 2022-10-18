// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {useDispatch} from 'react-redux';
import {searchProfiles} from 'mattermost-webapp/packages/mattermost-redux/src/actions/users';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

import GenericModal from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {useManageRunMembership} from 'src/graphql/hooks';
import CheckboxInput from '../../runs_list/checkbox_input';

import ParticipantsSelector from './participants_selector';

interface Props {
    playbookRun: PlaybookRun;
    id: string;
    title: React.ReactNode;
    show: boolean;
    hideModal: () => void;
}

const AddParticipantsModal = ({playbookRun, id, title, show, hideModal}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const {addToRun} = useManageRunMembership(playbookRun.id);
    const [addToChannel, setAddToChannel] = useState(false);

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbookRun.team_id}));
    };

    const header = (
        <Header>
            {title}
        </Header>
    );

    let footer = (
        <FooterExtraInfoContainer>
            <LightningBoltOutlineIcon
                size={18}
                color={'rgba(var(--center-channel-color-rgb), 0.56)'}
            />
            {formatMessage({defaultMessage: 'Participants will also be added to the channel linked to this run'})}
        </FooterExtraInfoContainer>
    );
    if (!playbookRun.create_channel_member_on_new_participant) {
        footer = (
            <StyledCheckboxInput
                testId={'also-add-to-channel'}
                text={formatMessage({defaultMessage: 'Also add people to the channel linked to this run'})}
                checked={addToChannel}
                onChange={(checked) => setAddToChannel(checked)}
            />
        );
    }

    const onConfirm = () => {
        const ids = profiles.map((e) => e.id);
        addToRun(ids);
        hideModal();
    };

    return (
        <GenericModal
            id={id}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            confirmButtonText={formatMessage({defaultMessage: 'Add'})}
            handleConfirm={onConfirm}
            isConfirmDisabled={!profiles || profiles.length === 0}

            onExited={() => {/* do nothing else after the modal has exited */}}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            footer={footer}
            components={{
                Header: ModalHeader,
                FooterContainer: StyledFooterContainer,
            }}
        >
            <ParticipantsSelector
                searchProfiles={searchUsers}
                setValues={setProfiles}
            />
        </GenericModal>
    );
};

export const useAddParticipants = (playbookRun: PlaybookRun) => {
    const {formatMessage} = useIntl();
    const [showModal, setShowModal] = useState(false);

    const addParticipantsModal = (
        <AddParticipantsModal
            playbookRun={playbookRun}
            id={'add-participants-rdp'}
            show={showModal}
            title={formatMessage({defaultMessage: 'Add people to {runName}'}, {runName: playbookRun.name})}
            hideModal={() => setShowModal(false)}
        />
    );

    return {
        addParticipantsModal,
        showAddParticipantsModal: () => {
            setShowModal(true);
        },
    };
};

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 16px;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledFooterContainer = styled.div`
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
`;

const FooterExtraInfoContainer = styled.div`
    display: flex;
    flex-direction: row;

    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    align-items: center;
    margin-right: auto;
    color: rgba(var(--center-channel-color-rgb), 0.56);
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

export default AddParticipantsModal;
