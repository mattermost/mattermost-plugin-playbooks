import React, {FC} from 'react';
import AsyncSelect from 'react-select/async';
import {OptionsType} from 'react-select';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import {ActionFunc} from 'mattermost-redux/types/actions';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {Playbook} from 'src/types/playbook';

const StyledAsyncSelect = styled(AsyncSelect)`
    flex-grow: 1;
    background-color: var(--center-channel-bg);

    .channel-selector__menu-list {
        background-color: var(--center-channel-bg);
        border: none;
    }

    .channel-selector__input {
        color: var(--center-channel-color);
    }

    .channel-selector__option--is-selected {
        background-color: var(--center-channel-color-08);
    }

    .channel-selector__option--is-focused {
        background-color: var(--center-channel-color-16);
    }

    .channel-selector__control {
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }
    }

    .channel-selector__option {
        &:active {
            background-color: var(--center-channel-color-08);
        }
    }

    .channel-selector__single-value {
        color: var(--center-channel-color);
    }
`;

export interface Props {
    searchChannels: (term: string) => ActionFunc;
    onChannelSelected: (channelID: string) => void;
    playbook: Playbook;
}

const ChannelSelector: FC<Props> = (props: Props) => {
    type GetChannelType = (channelID: string) => Channel
    const getChannelFromID = useSelector<GlobalState, GetChannelType>((state) => (channelID) => getChannel(state, channelID));
    const dispatch = useDispatch();

    const onChange = (channel: Channel) => {
        props.onChannelSelected(channel.id);
    };

    const getOptionValue = (channel: Channel) => {
        return channel.id;
    };

    const formatOptionLabel = (channel: Channel) => {
        return (
            <React.Fragment>
                {channel.display_name}
            </React.Fragment>
        );
    };

    const channelsLoader = (term: string, callback: (options: OptionsType<Channel>) => void) => {
        // @ts-ignore
        props.searchChannels(term.trim()).then(({data} : {data: Channel[]}) => callback(data));
    };

    return (
        <StyledAsyncSelect
            isMulti={false}
            controlShouldRenderValue={true}
            cacheOptions={false}
            defaultOptions={true}
            loadOptions={channelsLoader}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            value={getChannelFromID(props.playbook.broadcast_channel_id)}
            placeholder={'Select a channel'}
            classNamePrefix='channel-selector'
        />
    );
};

export default ChannelSelector;
