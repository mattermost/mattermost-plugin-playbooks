// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {PatternedInput} from 'src/components/backstage/playbook_edit/automation/patterned_input';
import {AutomationHeader, AutomationTitle} from 'src/components/backstage/playbook_edit/automation/styles';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {HorizontalSpacer, RadioInput} from 'src/components/backstage/styles';
import {SecondaryButtonLarger} from 'src/components/backstage/playbook_editor/controls';

type PlaybookSubset = Pick<PlaybookWithChecklist, 'create_public_playbook_run' | 'channel_name_template' | 'delete_at'>;

interface Props {
    playbook: PlaybookSubset;
    setPlaybook: React.Dispatch<React.SetStateAction<PlaybookSubset>>;
    setChangesMade?: (b: boolean) => void;
}

export const CreateAChannel = ({playbook, setPlaybook, setChangesMade}: Props) => {
    const {formatMessage} = useIntl();
    const archived = playbook.delete_at !== 0;

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

    return (
        <AutomationHeader>
            <AutomationTitle css={{alignSelf: 'flex-start'}}>
                <Toggle
                    isChecked={true}
                    disabled={true}
                    onChange={() => null}
                />
                <div>{formatMessage({defaultMessage: 'Create a channel'})}</div>
            </AutomationTitle>
            <HorizontalSplit>
                <VerticalSplit>
                    <ButtonLabel>
                        <RadioInput
                            type='radio'
                            disabled={archived}
                            checked={playbook.create_public_playbook_run}
                            onChange={() => handlePublicChange(true)}
                        />
                        <Icon
                            active={playbook.create_public_playbook_run}
                            className={'icon-globe'}
                        />
                        <BigText>{formatMessage({defaultMessage: 'Public'})}</BigText>
                    </ButtonLabel>
                    <HorizontalSpacer size={8}/>
                    <ButtonLabel>
                        <RadioInput
                            type='radio'
                            disabled={archived}
                            checked={!playbook.create_public_playbook_run}
                            onChange={() => handlePublicChange(false)}
                        />
                        <Icon
                            active={!playbook.create_public_playbook_run}
                            className={'icon-lock-outline'}
                        />
                        <BigText>{formatMessage({defaultMessage: 'Private'})}</BigText>
                    </ButtonLabel>
                </VerticalSplit>
                <PatternedInput
                    enabled={!archived}
                    input={playbook.channel_name_template}
                    onChange={handleChannelNameTemplateChange}
                    pattern={'[\\S][\\s\\S]*[\\S]'} // at least two non-whitespace characters
                    placeholderText={formatMessage({defaultMessage: 'Channel name template (optional)'})}
                    type={'text'}
                    errorText={formatMessage({defaultMessage: 'Channel name is not valid.'})}
                />
                <ChannelActionButton>
                    <LightningBoltOutlineIcon/>
                    {formatMessage({defaultMessage: 'Setup channel actions'})}
                </ChannelActionButton>
            </HorizontalSplit>
        </AutomationHeader>
    );
};

const VerticalSplit = styled.div`
    display: flex;
`;

const HorizontalSplit = styled.div`
    display: block;
    text-align: left;
`;

const ButtonLabel = styled.label`
    padding: 10px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    border-radius: 4px;
    flex-grow: 1;
    flex-basis: 0;
    margin: 0 0 8px 0;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    display: flex;
    align-items: center;
    cursor: pointer;
`;

const Icon = styled.i<{ active?: boolean }>`
    font-size: 16px;
    line-height: 16px;
    color: ${(props) => (props.active ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

const BigText = styled.div`
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
`;

const ChannelActionButton = styled(SecondaryButtonLarger)`
    margin-top: 8px;
`;
