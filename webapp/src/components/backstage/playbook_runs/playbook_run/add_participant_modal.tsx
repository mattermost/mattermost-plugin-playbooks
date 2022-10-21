// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {searchProfiles} from 'mattermost-webapp/packages/mattermost-redux/src/actions/users';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import {OptionTypeBase, StylesConfig} from 'react-select';

import GenericModal from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {useManageRunMembership} from 'src/graphql/hooks';
import CheckboxInput from '../../runs_list/checkbox_input';
import {isCurrentUserChannelMember} from 'src/selectors';

import ProfileAutocomplete from '../../profile_autocomplete';

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
    const isChannelMember = useSelector(isCurrentUserChannelMember(playbookRun.channel_id));

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbookRun.team_id}));
    };

    const header = (
        <Header>
            {title}
        </Header>
    );

    const renderFooter = () => {
        // disable footer until we participants actions PR(#1518) is merged to keep the master branch clean
        return null;

        if (playbookRun.create_channel_member_on_new_participant) {
            return (
                <FooterExtraInfoContainer>
                    <LightningBoltOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                    {formatMessage({defaultMessage: 'Participants will also be added to the channel linked to this run'})}
                </FooterExtraInfoContainer>
            );
        }
        if (isChannelMember) {
            return (
                <StyledCheckboxInput
                    testId={'also-add-to-channel'}
                    text={formatMessage({defaultMessage: 'Also add people to the channel linked to this run'})}
                    checked={addToChannel}
                    onChange={(checked) => setAddToChannel(checked)}
                />
            );
        }
        return null;
    };

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

            onExited={() => setProfiles([])}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            footer={renderFooter()}
            components={{
                Header: ModalHeader,
                FooterContainer: StyledFooterContainer,
            }}
        >
            <ProfileAutocomplete
                searchProfiles={searchUsers}
                userIds={[]}
                isDisabled={false}
                isMultiMode={true}
                customSelectStyles={selectStyles}
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

const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        minHeight: '48px',
        fontSize: '16px',
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '16px',
        paddingLeft: '8px',
        overflow: 'hidden',
        height: '32px',
        alignItems: 'center',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '16px',
        height: '16px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '16px',
            width: '16px',
        },
    }),
};

export default AddParticipantsModal;
