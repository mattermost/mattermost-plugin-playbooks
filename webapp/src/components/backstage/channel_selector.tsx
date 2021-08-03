import React from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';

import {Channel} from 'mattermost-redux/types/channels';

import {StyledSelect} from './styles';

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
    selectableChannels: Channel[];
}

const ChannelSelector = (props: Props & { className?: string }) => {
    const getChannelFromID = (channelId: string) => props.selectableChannels.find((channel) => channel.id === channelId) || {display_name: 'Unknown Channel', id: channelId};

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

    const filterOption = (option: {label: string, value: string, data: Channel}, term: string): boolean => {
        const channel = option.data as Channel;

        if (term.trim().length === 0) {
            return true;
        }

        return channel.name.toLowerCase().includes(term.toLowerCase()) ||
               channel.display_name.toLowerCase().includes(term.toLowerCase()) ||
               channel.id.toLowerCase() === term.toLowerCase();
    };

    const value = props.channelId && getChannelFromID(props.channelId);

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledSelect
            className={props.className}
            id={props.id}
            isMulti={false}
            controlShouldRenderValue={props.shouldRenderValue}
            options={props.selectableChannels}
            filterOption={filterOption}
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
