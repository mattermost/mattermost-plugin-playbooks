// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {useDispatch} from 'react-redux';
import {searchProfiles} from 'mattermost-webapp/packages/mattermost-redux/src/actions/users';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';

import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {PrimaryButton} from 'src/components/assets/buttons';
import {useManageRunMembership} from 'src/graphql/hooks';

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

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbookRun.team_id}));
    };

    const header = (
        <Header>
            {title}
        </Header>
    );

    const footer = (
        <StyledPrimaryButton
            disabled={!profiles || profiles.length === 0}
            onClick={() => {
                const ids = profiles.map((e) => e.id);
                addToRun(ids);
                hideModal();
            }}
        >
            {formatMessage({defaultMessage: 'Add'})}
        </StyledPrimaryButton>
    );

    return (
        <GenericModal
            id={id}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            onExited={() => {/* do nothing else after the modal has exited */}}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            footer={footer}
            components={{
                Header: ModalHeader,
                FooterContainer: DefaultFooterContainer,
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

const StyledPrimaryButton = styled(PrimaryButton)`
    height: 40px;
    font-weight: 600;
    font-size: 14px;
    line-height: 14px;
`;

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 16px;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
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

export default AddParticipantsModal;
