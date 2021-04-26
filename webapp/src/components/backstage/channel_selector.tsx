import React, {FC} from 'react';
import {OptionsType, SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {useSelector} from 'react-redux';
import {getMyChannels, getChannel} from 'mattermost-redux/selectors/entities/channels';

import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {StyledAsyncSelect} from './styles';

export interface Props {
    id?: string;
    onChannelSelected: (channelID: string | undefined) => void;
    channelId?: string;
    isClearable?: boolean;
    selectComponents?: SelectComponentsConfig<Channel>;
    isDisabled: boolean;
    captureMenuScroll: boolean;
    shouldRenderValue: boolean;
    placeholder?: string;
}

const ChannelSelector: FC<Props & { className?: string }> = (props: Props & { className?: string }) => {
    const selectableChannels = useSelector(getMyChannels);

    type GetChannelType = (channelID: string) => Channel
    const getChannelFromID = useSelector<GlobalState, GetChannelType>((state) => (channelID) => getChannel(state, channelID) || {display_name: 'Unknown Channel', id: channelID});

    const onChange = (channel: Channel | null, {action}: {action: string}) => {
        if (action === 'clear') {
            props.onChannelSelected('');
        } else {
            props.onChannelSelected(channel?.id);
        }
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
        if (term.trim().length === 0) {
            callback(selectableChannels);
        } else {
            // Implement rudimentary channel name searches.
            callback(selectableChannels.filter((channel) => (
                channel.name.toLowerCase().includes(term.toLowerCase()) ||
                channel.display_name.toLowerCase().includes(term.toLowerCase()) ||
                channel.id.toLowerCase() === term.toLowerCase()
            )));
        }
    };

    const value = props.channelId && getChannelFromID(props.channelId);

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledAsyncSelect
            className={props.className}
            id={props.id}
            isMulti={false}
            controlShouldRenderValue={props.shouldRenderValue}
            cacheOptions={false}
            defaultOptions={true}
            loadOptions={channelsLoader}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={props.isClearable}
            value={value}
            placeholder={props.placeholder || 'Select a channel'}
            classNamePrefix='channel-selector'
            components={components}
            isDisabled={props.isDisabled}
            captureMenuScroll={props.captureMenuScroll}
        />
    );
};

export default ChannelSelector;
