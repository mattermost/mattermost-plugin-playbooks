// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {CodeBracketsIcon, SettingsOutlineIcon} from '@mattermost/compass-icons/components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {
    AutomationHeader,
    AutomationLabel,
    AutomationTitle,
    SelectorWrapper,
} from 'src/components/backstage/playbook_edit/automation/styles';
import {HorizontalSpacer, RadioInput} from 'src/components/backstage/styles';
import {showPlaybookActionsModal} from 'src/actions';
import {SecondaryButtonLarger} from 'src/components/backstage/playbook_editor/controls';
import ChannelSelector from 'src/components/backstage/channel_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';
import {TemplateInput} from 'src/components/backstage/playbook_edit/automation/template_input';
import {BaseInput} from 'src/components/assets/inputs';

type PlaybookSubset = Pick<PlaybookWithChecklist, 'create_public_playbook_run' | 'channel_name_template' | 'delete_at' | 'channel_mode' | 'channel_id' | 'run_number_prefix' | 'next_run_number'>;

interface Props {
    playbook: PlaybookSubset;
    setPlaybook: React.Dispatch<React.SetStateAction<PlaybookSubset>>;
    setChangesMade?: (b: boolean) => void;
    fieldNames?: string[];
    disabled?: boolean;
}

export const CreateAChannel = ({playbook, setPlaybook, setChangesMade, fieldNames, disabled: disabledProp}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const teamId = useSelector(getCurrentTeamId);
    const disabled = disabledProp || playbook.delete_at !== 0;
    const [insertCounter, setInsertCounter] = useState(0);
    const templateEnabled = !disabled && playbook.channel_mode === 'create_new_channel';

    const handlePublicChange = (isPublic: boolean) => {
        setPlaybook({
            ...playbook,
            create_public_playbook_run: isPublic,
        });
        setChangesMade?.(true);
    };

    const handleChannelNameTemplateChange = (channelNameTemplate: string) => {
        setPlaybook({
            ...playbook,
            channel_name_template: channelNameTemplate,
        });
        setChangesMade?.(true);
    };

    const handleRunNumberPrefixChange = (runNumberPrefix: string) => {
        setPlaybook({
            ...playbook,
            run_number_prefix: runNumberPrefix,
        });
        setChangesMade?.(true);
    };

    const handleChannelModeChange = (mode: 'create_new_channel' | 'link_existing_channel') => {
        setPlaybook({
            ...playbook,
            channel_mode: mode,
        });
        setChangesMade?.(true);
    };
    const handleChannelIdChange = (channel_id: string) => {
        setPlaybook({
            ...playbook,
            channel_id,
        });
        setChangesMade?.(true);
    };

    return (
        <Container>
            <AutomationHeader id={'link-existing-channel'}>
                <AutomationTitle
                    style={{alignSelf: 'flex-start'}}
                >
                    <AutomationLabel disabled={disabled}>
                        <ChannelModeRadio
                            type='radio'
                            disabled={disabled}
                            checked={playbook.channel_mode === 'link_existing_channel'}
                            onChange={() => handleChannelModeChange('link_existing_channel')}
                        />
                        <FormattedMessage defaultMessage='Link to an existing channel'/>
                    </AutomationLabel>
                </AutomationTitle>
                <SelectorWrapper>
                    <StyledChannelSelector
                        id={'link_existing_channel_selector'}
                        onChannelSelected={(channel_id: string) => handleChannelIdChange(channel_id)}
                        channelIds={playbook.channel_id === '' ? [] : [playbook.channel_id]}
                        isClearable={true}
                        selectComponents={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
                        isDisabled={disabled || playbook.channel_mode === 'create_new_channel'}
                        captureMenuScroll={false}
                        shouldRenderValue={true}
                        teamId={teamId}
                        isMulti={false}
                    />
                </SelectorWrapper>
            </AutomationHeader>
            <AutomationHeader id={'create-new-channel'}>
                <AutomationTitle style={{alignSelf: 'flex-start'}} >
                    <AutomationLabel disabled={disabled}>
                        <ChannelModeRadio
                            type='radio'
                            disabled={disabled}
                            checked={playbook.channel_mode === 'create_new_channel'}
                            onChange={() => handleChannelModeChange('create_new_channel')}
                        />
                        <FormattedMessage defaultMessage='Create a run channel'/>
                    </AutomationLabel>
                </AutomationTitle>
                <HorizontalSplit>
                    <VerticalSplit>
                        <ButtonLabel disabled={disabled || playbook.channel_mode === 'link_existing_channel'}>
                            <RadioInput
                                type='radio'
                                disabled={disabled || playbook.channel_mode === 'link_existing_channel'}
                                checked={playbook.create_public_playbook_run}
                                onChange={() => handlePublicChange(true)}
                            />
                            <Icon
                                $disabled={playbook.channel_mode === 'link_existing_channel'}
                                $active={playbook.create_public_playbook_run}
                                className={'icon-globe'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Public'})}</BigText>
                        </ButtonLabel>
                        <HorizontalSpacer $size={8}/>
                        <ButtonLabel disabled={disabled || playbook.channel_mode === 'link_existing_channel'}>
                            <RadioInput
                                type='radio'
                                disabled={disabled || playbook.channel_mode === 'link_existing_channel'}
                                checked={!playbook.create_public_playbook_run}
                                onChange={() => handlePublicChange(false)}
                            />
                            <Icon
                                $disabled={playbook.channel_mode === 'link_existing_channel'}
                                $active={!playbook.create_public_playbook_run}
                                className={'icon-lock-outline'}
                            />
                            <BigText>{formatMessage({defaultMessage: 'Private'})}</BigText>
                        </ButtonLabel>
                    </VerticalSplit>
                    <RunNamingBlock>
                        <InputLabel>{formatMessage({defaultMessage: 'Run number prefix'})}</InputLabel>
                        <BaseInput
                            data-testid='channel-access-run-number-prefix'
                            type='text'
                            disabled={disabled || playbook.channel_mode === 'link_existing_channel'}
                            value={playbook.run_number_prefix ?? ''}
                            onChange={(e) => handleRunNumberPrefixChange(e.target.value)}
                            placeholder={formatMessage({defaultMessage: 'e.g. INC-'})}
                        />
                        <LabelRow>
                            <InputLabel>{formatMessage({defaultMessage: 'Run name template'})}</InputLabel>
                            {templateEnabled && (
                                <InsertVariableButton
                                    type='button'
                                    onClick={() => setInsertCounter((n) => n + 1)}
                                    aria-label={formatMessage({defaultMessage: 'Insert variable'})}
                                    title={formatMessage({defaultMessage: 'Insert variable'})}
                                    data-testid='channel-access-run-name-template-insert-variable'
                                >
                                    <CodeBracketsIcon
                                        size={14}
                                        aria-hidden={true}
                                    />
                                </InsertVariableButton>
                            )}
                        </LabelRow>
                        <TemplateInput
                            enabled={templateEnabled}
                            placeholderText={formatMessage({defaultMessage: 'Run name template (optional)'})}
                            input={playbook.channel_name_template ?? ''}
                            onChange={handleChannelNameTemplateChange}
                            fieldNames={fieldNames ?? []}
                            prefix={playbook.run_number_prefix ?? ''}
                            testId='channel-access-run-name-template'
                            openInsertToggle={insertCounter}
                        />
                    </RunNamingBlock>
                    <ChannelActionButton
                        disabled={disabled || playbook.channel_mode === 'link_existing_channel'}
                        data-testid='playbook-channel-actions-button'
                        onClick={() => dispatch(showPlaybookActionsModal())}
                    >
                        <SettingsOutlineIcon size={16}/>
                        {formatMessage({defaultMessage: 'Configure channel'})}
                    </ChannelActionButton>
                </HorizontalSplit>
            </AutomationHeader>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const VerticalSplit = styled.div`
    display: flex;
`;

const HorizontalSplit = styled.div`
    display: block;
    text-align: left;
`;

export const ButtonLabel = styled.label<{disabled: boolean}>`
    display: flex;
    flex-basis: 0;
    flex-grow: 1;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin: 0 0 8px;
    background: ${({disabled}) => (disabled ? 'rgba(var(--center-channel-color-rgb), 0.04)' : 'var(--center-channel-bg)')};
    cursor: pointer;
`;

const Icon = styled.i<{$active?: boolean, $disabled: boolean}>`
    color: ${({$active, $disabled}) => ($active && !$disabled ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    font-size: 16px;
    line-height: 16px;
`;

const BigText = styled.div`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
`;

const ChannelActionButton = styled(SecondaryButtonLarger)`
    height: 40px;
    margin-top: 8px;
`;

export const StyledChannelSelector = styled(ChannelSelector)`
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .playbooks-rselect__control {
        padding: 4px 16px 4px 3.2rem;

        &::before {
            position: absolute;
            top: 8px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }
`;

export const ChannelModeRadio = styled(RadioInput)`
    && {
        margin: 0 8px;
    }
`;

const RunNamingBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
`;

const InputLabel = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-top: 8px;
`;

const LabelRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const InsertVariableButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--button-bg);
    }
`;
