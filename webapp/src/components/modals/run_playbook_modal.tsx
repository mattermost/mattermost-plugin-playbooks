import React, {ComponentProps, useState, useEffect} from 'react';

import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {Client4} from 'mattermost-redux/client';

import {NotebookOutlineIcon, AccountOutlineIcon} from '@mattermost/compass-icons/components';
import {GlobalState} from '@mattermost/types/store';

import {displayUsername, getFullName} from 'mattermost-redux/utils/user_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {UserProfile} from '@mattermost/types/users';

import {usePlaybook} from 'src/hooks';
import {BaseInput} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel, Description} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {navigateToPluginUrl} from 'src/browser_routing';
import {useLHSRefresh} from '../backstage/lhs_navigation';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (playbookId: string, defaultOwnerId: string | null, description: string, teamId: string, teamName: string) => ({
    modalId: ID,
    dialogType: RunPlaybookModal,
    dialogProps: {playbookId, defaultOwnerId, description, teamId, teamName},
});

type Props = {
    playbookId: string,
    defaultOwnerId: string | null,
    description: string,
    teamId: string,
    teamName: string
} & Partial<ComponentProps<typeof GenericModal>>;

const RunPlaybookModal = ({
    playbookId,
    defaultOwnerId,
    description,
    teamId,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const refreshLHS = useLHSRefresh();

    const [runName, setRunName] = useState('');
    let userId = useSelector(getCurrentUserId);
    if (defaultOwnerId) {
        userId = defaultOwnerId;
    }
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userId));
    const teammateNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const playbookOwner = getFullName(user) || displayUsername(user, teammateNameDisplaySetting);
    const profileUri = Client4.getProfilePictureUrl(user.id, user.last_picture_update);

    const playbook = usePlaybook(playbookId)[0];

    useEffect(() => {
        if (playbook) {
            setRunName(playbook.channel_name_template);
        }
    }, [playbook, playbook?.id]);

    const onSubmit = () => {
        createPlaybookRun(playbookId, user.id, teamId, runName, description)
            .then((newPlaybookRun) => {
                modalProps.onHide?.();
                navigateToPluginUrl(`/runs/${newPlaybookRun.id}`);
                refreshLHS();
            }).catch(() => {
            // show error
            });
    };

    return (
        <StyledGenericModal
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
                            <NotebookOutlineIcon size={14}/>
                            <div>{formatMessage({defaultMessage: 'Playbook'})}</div>
                        </PlaybookNameTitle>
                        <PlaybookName>
                            {playbook?.title}
                        </PlaybookName>
                    </PlaybookNameAndTitle>
                    <PlaybookOwnerAndTitle>
                        <PlaybookOwnerTitle>
                            <AccountOutlineIcon size={14}/>
                            <div>
                                {formatMessage({defaultMessage: 'Owner'})}
                            </div>
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
                        if (e.key === 'Enter') {
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
