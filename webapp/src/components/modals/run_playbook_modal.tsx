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

import {useLinkRunToExistingChannelEnabled, usePlaybook} from 'src/hooks';
import {BaseInput} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel, Description} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {navigateToPluginUrl} from 'src/browser_routing';
import {AutomationTitle} from '../backstage/playbook_edit/automation/styles';
import {ButtonLabel, StyledChannelSelector, VerticalSplit} from '../backstage/playbook_edit/automation/channel_access';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from '../backstage/playbook_edit/automation/menu_list';
import {HorizontalSpacer, RadioInput} from '../backstage/styles';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (
    playbookId: string,
    defaultOwnerId: string | null,
    description: string,
    teamId: string,
    teamName: string,
    refreshLHS?: () => void
) => ({
    modalId: ID,
    dialogType: RunPlaybookModal,
    dialogProps: {playbookId, defaultOwnerId, description, teamId, teamName, refreshLHS},
});

type Props = {
    playbookId: string,
    defaultOwnerId: string | null,
    description: string,
    teamId: string,
    teamName: string
    refreshLHS?: () => void
} & Partial<ComponentProps<typeof GenericModal>>;

const RunPlaybookModal = ({
    playbookId,
    defaultOwnerId,
    description,
    teamId,
    refreshLHS,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();

    const [runName, setRunName] = useState('');
    let userId = useSelector(getCurrentUserId);
    if (defaultOwnerId) {
        userId = defaultOwnerId;
    }
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userId));
    const teammateNameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) || '';
    const playbookOwner = getFullName(user) || displayUsername(user, teammateNameDisplaySetting);
    const profileUri = Client4.getProfilePictureUrl(user.id, user.last_picture_update);
    const linkRunToExistingChannelEnabled = useLinkRunToExistingChannelEnabled();

    const playbook = usePlaybook(playbookId)[0];
    const [channelMode, setChannelMode] = useState('');
    const [channelId, setChannelId] = useState('');
    const [createPublicRun, setCreatePublicRun] = useState(false);

    useEffect(() => {
        if (playbook) {
            setRunName(playbook.channel_name_template);
            setChannelMode(playbook.channel_mode);
            setChannelId(playbook.channel_id);
            setCreatePublicRun(playbook.create_public_playbook_run);
        }
    }, [playbook, playbook?.id]);

    const createNewChannel = channelMode === 'create_new_channel';
    const linkExistingChannel = channelMode === 'link_existing_channel';

    const onSubmit = () => {
        createPlaybookRun(
            playbookId,
            user.id,
            teamId,
            runName,
            description,
            linkExistingChannel ? channelId : undefined,
            createNewChannel ? createPublicRun : undefined,
        )
            .then((newPlaybookRun) => {
                modalProps.onHide?.();
                navigateToPluginUrl(`/runs/${newPlaybookRun.id}?from=run_modal`);
                refreshLHS?.();
            }).catch(() => {
            // show error
            });
    };

    const channelConfigSection = (
        <Container>
            <AutomationTitle
                css={{alignSelf: 'flex-start'}}
            >
                <StyledRadioInput
                    data-testid={'link-existing-channel-radio'}
                    type='radio'
                    checked={linkExistingChannel}
                    onChange={() => setChannelMode('link_existing_channel')}
                />
                <div>{formatMessage({defaultMessage: 'Link to an existing channel'})}</div>
            </AutomationTitle>
            {linkExistingChannel && (
                <SelectorWrapper>
                    <StyledChannelSelector
                        id={'link-existing-channel-selector'}
                        onChannelSelected={(channel_id: string) => setChannelId(channel_id)}
                        channelIds={channelId ? [channelId] : []}
                        isClearable={true}
                        selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                        isDisabled={false}
                        captureMenuScroll={false}
                        shouldRenderValue={true}
                        teamId={teamId}
                        isMulti={false}
                    />
                </SelectorWrapper>
            )}

            <AutomationTitle css={{alignSelf: 'flex-start'}} >
                <StyledRadioInput
                    data-testid={'create-channel-radio'}
                    type='radio'
                    checked={createNewChannel}
                    onChange={() => setChannelMode('create_new_channel')}
                />
                <div>{formatMessage({defaultMessage: 'Create a run channel'})}</div>
            </AutomationTitle>

            {createNewChannel && (
                <HorizontalSplit>
                    <VerticalSplit>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-public-channel-radio'}
                                type='radio'
                                checked={createPublicRun}
                                onChange={() => setCreatePublicRun(true)}
                            />
                            <Icon
                                disabled={false}
                                active={createPublicRun}
                                className={'icon-globe'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Public channel'})}</BigText>
                        </ButtonLabel>
                        <HorizontalSpacer size={8}/>
                        <ButtonLabel disabled={false}>
                            <RadioInput
                                data-testid={'create-private-channel-radio'}
                                type='radio'
                                checked={!createPublicRun}
                                onChange={() => setCreatePublicRun(false)}
                            />
                            <Icon
                                disabled={false}
                                active={!createPublicRun}
                                className={'icon-lock-outline'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Private channel'})}</BigText>
                        </ButtonLabel>
                    </VerticalSplit>
                </HorizontalSplit>
            )}
        </Container>
    );

    const isFormValid = runName !== '' && (createNewChannel || channelId !== '');

    return (
        <StyledGenericModal
            modalHeaderText={formatMessage({defaultMessage: 'Run Playbook'})}
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
            isConfirmDisabled={!isFormValid}
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
                    data-testid={'run-name-input'}
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
                    {createNewChannel && formatMessage({defaultMessage: 'A channel will be created with this name'})}
                </Description>
                {linkRunToExistingChannelEnabled && channelConfigSection}
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

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const StyledRadioInput = styled(RadioInput)`
    && {
        margin: 0;
    }
`;

export const SelectorWrapper = styled.div`
    margin-left: 28px;
    min-height: 40px;
`;

const Icon = styled.i<{ active?: boolean, disabled: boolean }>`
    font-size: 16px;
    line-height: 16px;
    color: ${({active, disabled}) => (active && !disabled ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const BigText = styled.div`
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
`;

const HorizontalSplit = styled.div`
    display: block;
    text-align: left;
    margin-left: 28px;
`;

export default RunPlaybookModal;
