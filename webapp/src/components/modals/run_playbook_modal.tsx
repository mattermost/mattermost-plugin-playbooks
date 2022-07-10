import React, {ComponentProps, useState, useEffect} from 'react';

import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {Client4} from 'mattermost-redux/client';

import Icon from '@mdi/react';
import {mdiNotebookOutline, mdiAccountOutline} from '@mdi/js';

import {GlobalState} from 'mattermost-redux/types/store';

import {displayUsername, getFullName} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {usePlaybook} from 'src/hooks';
import {BaseInput} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel, Description} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {navigateToUrl} from 'src/browser_routing';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (playbookId: string, description: string, teamId: string, teamName: string) => ({
    modalId: ID,
    dialogType: RunPlaybookModal,
    dialogProps: {playbookId, description, teamId, teamName},
});

type Props = {
    playbookId: string,
    description: string,
    teamId: string,
    teamName: string
} & Partial<ComponentProps<typeof GenericModal>>;

const owner = 'Owner';
const playbookRunDescription = 'A channel will be created with this name';

const RunPlaybookModal = ({
    playbookId,
    description,
    teamId,
    teamName,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();

    const [showModal, setShowModal] = useState(true);
    const [runName, setRunName] = useState('');
    const currentUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';

    const playbookOwner = getFullName(currentUser) || displayUsername(currentUser, teamnameNameDisplaySetting);
    const profileUri = Client4.getProfilePictureUrl(currentUser.id, currentUser.last_picture_update);
    const playbook = usePlaybook(playbookId);

    useEffect(() => {
        if (playbook) {
            setRunName(playbook.channel_name_template);
        }
    }, [playbook, playbook?.id]);

    const onSubmit = () => {
        const playbookRun = createPlaybookRun(playbookId, currentUser.id, teamId, runName, description);
        playbookRun.then(async (newPlaybookRun) => {
            modalProps.onHide?.();
            const pathname = `/playbooks/runs/${newPlaybookRun.id}`;
            const search = '';
            navigateToUrl({pathname, search});
        }).catch(() => {
            // show error
        });
    };

    return (
        <StyledGenericModal
            show={showModal}
            modalHeaderText={formatMessage({defaultMessage: 'Run Playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
            handleConfirm={onSubmit}
            id={ID}
            handleCancel={() => true}
            {...modalProps}
        >
            <Body>
                <PlaybookDetail>
                    <PlaybookNameAndTitle>
                        <PlaybookNameTitle>
                            <PlaybookIcon
                                path={mdiNotebookOutline}
                                size={0.95}
                            />
                            <div>{formatMessage({defaultMessage: 'Playbook'})}</div>
                        </PlaybookNameTitle>
                        <PlaybookName>
                            {runName}
                        </PlaybookName>
                    </PlaybookNameAndTitle>
                    <PlaybookOwnerAndTitle>
                        <PlaybookOwnerTitle>
                            <PlaybookIcon
                                path={mdiAccountOutline}
                                size={0.95}
                            />
                            <div>{formatMessage({defaultMessage: 'Owner'})}</div>
                        </PlaybookOwnerTitle>
                        <PlaybookOwnerDetail>
                            <OwnerImage
                                className='image'
                                src={profileUri || ''}
                            />
                            <PlaybookOwner>
                                {playbookOwner}
                            </PlaybookOwner>
                        </PlaybookOwnerDetail>
                    </PlaybookOwnerAndTitle>
                </PlaybookDetail>
                <InlineLabel>{formatMessage({defaultMessage: 'Run name'})}</InlineLabel>
                <BaseInput
                    autoFocus={true}
                    type={'text'}
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                            onSubmit();
                        }
                    }}
                />
                <Description
                    css={`
                        font-size: 12px;
                        color: rgba(var(--center-channel-color-rgb), 0.56);
                    `}
                >
                    {formatMessage({defaultMessage: 'A channel will be created with this name'})}
                </Description>
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        .modal-header {
            padding: 28px 31px;
            box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
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

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

const PlaybookIcon = styled(Icon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const PlaybookDetail = styled.div`
    display: flex;
    justify-content: space-between;
`;

const PlaybookNameAndTitle = styled.div`
    display: flex;
    flex-direction: column;
    width: 50%;
`;

const PlaybookNameTitle = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: bolder;
    padding-bottom: 5px;
    align-items: center;
    > div {
        padding-left: 5px;
    }
`;

const PlaybookName = styled.div``;

const PlaybookOwnerAndTitle = styled.div`
    display: flex;
    flex-direction: column;
    width: 50%;
`;

const PlaybookOwnerTitle = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: bolder;
    padding-bottom: 5px;
    align-items: center;
    > div {
        padding-left: 5px;
    }
`;

const OwnerImage = styled.img`
    margin: 0 4px 0 0;
    width: 24px;
    height: 24px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;
    .image-sm {
        width: 24px;
        height: 24px;
    }
`;

const PlaybookOwnerDetail = styled.div`
   display: flex;
   align-items: center;
`;

const PlaybookOwner = styled.div``;

export default RunPlaybookModal;
