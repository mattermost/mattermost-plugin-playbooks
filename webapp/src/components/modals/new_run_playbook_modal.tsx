import React, {ComponentProps, useState, useEffect} from 'react';

import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import Modal from 'react-bootstrap/Modal';

import {usePlaybook} from 'src/hooks';
import {BaseInput, BaseTextArea} from 'src/components/assets/inputs';
import GenericModal, {InlineLabel} from 'src/components/widgets/generic_modal';
import {createPlaybookRun} from 'src/client';
import {navigateToPluginUrl} from 'src/browser_routing';
import {ButtonLabel, StyledChannelSelector, VerticalSplit} from '../backstage/playbook_edit/automation/channel_access';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';
import {HorizontalSpacer, RadioInput} from 'src/components/backstage/styles';

const ID = 'playbooks_run_playbook_dialog';

export const makeModalDefinition = (
    playbookId: string,
    defaultOwnerId: string | null, // TO BE REMOVED
    description: string, // TO BE REMOVED
    teamId: string, // TO BE REMOVED
    teamName: string, // TO BE REMOVED
    refreshLHS?: () => void
) => ({
    modalId: ID,
    dialogType: RunPlaybookNewModal,
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

const RunPlaybookNewModal = ({
    playbookId,
    defaultOwnerId,
    description,
    teamId,
    refreshLHS,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();

    let userId = useSelector(getCurrentUserId);
    if (defaultOwnerId) {
        userId = defaultOwnerId;
    }
    const user = useSelector<GlobalState, UserProfile>((state) => getUser(state, userId));

    const [playbook] = usePlaybook(playbookId);
    const [step, setStep] = useState(playbookId === '' ? 'select-playbook' : 'run-details');
    const [runName, setRunName] = useState('');
    const [runSummary, setRunSummary] = useState('');
    const [channelMode, setChannelMode] = useState('');
    const [channelId, setChannelId] = useState('');
    const [createPublicRun, setCreatePublicRun] = useState(false);

    useEffect(() => {
        if (playbook && playbook.channel_mode === 'create_new_channel') {
            setRunName(playbook.channel_name_template);
        }
    }, [playbook, playbook?.channel_name_template, playbook?.channel_mode]);

    useEffect(() => {
        if (playbook && playbook?.run_summary_template_enabled) {
            setRunSummary(playbook.run_summary_template);
        }
    }, [playbook, playbook?.run_summary_template_enabled, playbook?.run_summary_template]);

    useEffect(() => {
        if (playbook) {
            setChannelMode(playbook.channel_mode);
        }
    }, [playbook, playbook?.channel_mode]);

    useEffect(() => {
        if (playbook) {
            setChannelId(playbook.channel_id);
        }
    }, [playbook, playbook?.channel_id]);

    useEffect(() => {
        if (playbook) {
            setCreatePublicRun(playbook.create_public_playbook_run);
        }
    }, [playbook, playbook?.create_public_playbook_run]);

    const createNewChannel = channelMode === 'create_new_channel';
    const linkExistingChannel = channelMode === 'link_existing_channel';

    const onSubmit = () => {
        if (!playbook) {
            return;
        }

        createPlaybookRun(
            playbookId,
            user.id,
            playbook.team_id,
            runName,
            runSummary,
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
        <ChannelContainer>
            <ChannelBlock>
                <StyledRadioInput
                    data-testid={'link-existing-channel-radio'}
                    type='radio'
                    checked={linkExistingChannel}
                    onChange={() => setChannelMode('link_existing_channel')}
                />
                <div>{formatMessage({defaultMessage: 'Link to an existing channel'})}</div>
            </ChannelBlock>
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

            <ChannelBlock >
                <StyledRadioInput
                    data-testid={'create-channel-radio'}
                    type='radio'
                    checked={createNewChannel}
                    onChange={() => setChannelMode('create_new_channel')}
                />
                <div>{formatMessage({defaultMessage: 'Create a run channel'})}</div>
            </ChannelBlock>

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
        </ChannelContainer>
    );

    const HeaderDetails = () => (
        <Modal.Header closeButton={true}>
            <Modal.Title><FormattedMessage defaultMessage={'Start a run'}/></Modal.Title>
        </Modal.Header>
    );

    // <ModalHeader
    //     title={formatMessage({defaultMessage: 'Start a run'})}
    //     onBack={() => setStep('select-playbook')}
    //     sideTitle={playbook ? playbook.title : ''}
    // />
    const HeaderSelectPlaybook = () => (
        <Modal.Header closeButton={true}>
            <Modal.Title><FormattedMessage defaultMessage={'Select a playbook'}/></Modal.Title>
        </Modal.Header>
    );

    const StepRunDetails = (
        <Body>
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

            <InlineLabel>{formatMessage({defaultMessage: 'Run summary'})}</InlineLabel>
            <BaseTextArea
                data-testid={'run-summary-input'}
                rows={5}
                value={runSummary}
                onChange={(e) => setRunSummary(e.target.value)}
            />
            {channelConfigSection}
        </Body>
    );

    const StepSelectPlaybook = (
        <Body>
            <span>Playbook list</span>
        </Body>
    );

    const isFormValid = runName !== '' && (createNewChannel || channelId !== '');

    return (
        <StyledGenericModal
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Start run'})}
            isConfirmDisabled={!isFormValid}
            handleConfirm={onSubmit}
            id={ID}
            handleCancel={() => true}
            components={{
                Header: HeaderDetails,
            }}
            {...modalProps}
        >
            {step === 'run-details' ? StepRunDetails : StepSelectPlaybook}
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        .modal-header {
            padding: 24px 31px;
            margin-bottom: 0;
            box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 24px 31px;
        }
        .modal-footer {
           box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
           padding: 0 31px 28px 31px;
        }
    }
`;

const ModalHeaderContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const ModalHeaderSide = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding-left: 20px;
    border-left: solid 1px rgba(var(--center-channel-color-rgb), 0.56);
`;

const ModalHeaderTitle = styled.div`
    font-size: 22px;
    color: var(--center-channel-color);
    font-weight: 600;
`;

const ModalHeaderIcon = styled.div`
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

const ChannelContainer = styled.div`
    margin-top: 39px;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const StyledRadioInput = styled(RadioInput)`
    && {
        margin: 0;
    }
`;

const ChannelBlock = styled.div`
    display: flex;
    flex-direction: row;
    width: 350px;
    align-items: center;
    column-gap: 12px;
    align-self: 'flex-start';
`;

const SelectorWrapper = styled.div`
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

export default RunPlaybookNewModal;
