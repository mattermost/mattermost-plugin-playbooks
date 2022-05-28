import React, {ComponentProps, useState} from 'react';

import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Client4} from 'mattermost-redux/client';

import Icon from '@mdi/react';
import {mdiNotebookOutline} from '@mdi/js';

import {GlobalState} from 'mattermost-redux/types/store';

import {displayUsername, getFullName} from 'mattermost-redux/utils/user_utils';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {usePlaybookName} from '../../hooks';
import {BaseInput} from '../assets/inputs';
import GenericModal, {InlineLabel, Description} from '../widgets/generic_modal';

type Props = {
    playbookId: string;
} & Partial<ComponentProps<typeof GenericModal>>;

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: RunPlaybookModal,
    dialogProps: props,
});

const Body = styled.div`
	display: flex;
	flex-direction: column;

	& > div, & > input {
		margin-bottom: 12px;
	}
`;

const playbook = 'Playbook';
const owner = 'Owner';
const playbookRunDescription = 'A channel will be created with this name';

const RunPlaybookModal = ({
    playbookId,
    ...props
}: Props) => {
    const {formatMessage} = useIntl();

    const [showModal, setShowModal] = useState(true);
    const [runName, setRunName] = useState('');
    const currentUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';

    const playbookOwner = getFullName(currentUser) || displayUsername(currentUser, teamnameNameDisplaySetting);
    const profileUri = Client4.getProfilePictureUrl(currentUser.id, currentUser.last_picture_update);

    const playbookName = usePlaybookName(playbookId);
    return (
        <StyledGenericModal
            show={showModal}
            modalHeaderText={formatMessage({defaultMessage: 'Run Playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
            handleConfirm={() => true}
            id={ID}
            {...props}
            handleCancel={() => true}
        >
            <Body>
                <PlaybookDetail>
                    <PlaybookName>
                        <NameTitle>
                            <PlaybookIcon
                                path={mdiNotebookOutline}
                                size={0.95}
                            />
                            {playbook}
                        </NameTitle>
                        {playbookName}
                    </PlaybookName>
                    <PlaybookOwner>
                        <OwnerTitle>
                            <PlaybookIcon
                                path={mdiNotebookOutline}
                                size={0.95}
                            />

                            {owner}
                        </OwnerTitle>
                        <OwnerDetail>
                            <OwnerImage
                                className='image'
                                src={profileUri || ''}
                            />
                            {playbookOwner}
                        </OwnerDetail>
                    </PlaybookOwner>
                </PlaybookDetail>
                <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                <BaseInput
                    autoFocus={true}
                    type={'text'}
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                />
                <Description>{playbookRunDescription}</Description>
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        .modal-header {
            padding: 28px 31px;
            box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb),0.16);
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 28px 31px;
        }
        .modal-footer {
           padding: 0 31px 28px 31px;
        }
    }
`;

const PlaybookIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const PlaybookDetail = styled.div`
    display: flex;
    justify-content: space-between
`;

const PlaybookName = styled.div`
    display: flex;
    flex-direction: column;
    width: 50%
`;

const NameTitle = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: bolder;
    padding-bottom: 5px;
    align-items: center;
`;

const PlaybookOwner = styled.div`
    display: flex;
    flex-direction: column;
    width: 50%
`;

const OwnerTitle = styled.div`
   display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: bolder;
    padding-bottom: 5px;
    align-items: center;
`;

const OwnerImage = styled.img`
    margin: 0 8px 0 0;
    width: 32px;
    height: 32px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;

    .image-sm {
        width: 24px;
        height: 24px;
    }
`;

const OwnerDetail = styled.div`
       display: flex;
       align-items: center;
`;

export default RunPlaybookModal;
