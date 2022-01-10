import React from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {useSelector} from 'react-redux';
import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import General from 'mattermost-redux/constants/general';

import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {useIntl} from 'react-intl';

import {StyledSelect} from './styles';

export interface Props {
    id?: string;
    onChannelsSelected: (channelIds: string[]) => void;
    channelIds: string[];
    isClearable?: boolean;
    selectComponents?: SelectComponentsConfig<Channel, boolean>;
    isDisabled: boolean;
    captureMenuScroll: boolean;
    shouldRenderValue: boolean;
    placeholder?: string;
}

const getMyPublicAndPrivateChannels = (state: GlobalState) => getMyChannels(state).filter((channel) =>
    channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL && channel.delete_at === 0,
);

const filterChannels = (channelIDs: string[], channels: Channel[]): Channel[] => {
    if (!channelIDs || !channels) {
        return [];
    }

    const channelsMap = new Map<string, Channel>();
    channels.forEach((channel: Channel) => channelsMap.set(channel.id, channel));

    const result: Channel[] = [];
    channelIDs.forEach((id: string) => {
        let filteredChannel: Channel;
        const channel = channelsMap.get(id);
        if (channel && channel.delete_at === 0) {
            filteredChannel = channel;
        } else {
            filteredChannel = {display_name: '', id} as Channel;
        }
        result.push(filteredChannel);
    });
    return result;
};

const ChannelSelector = (props: Props & {className?: string}) => {
    const {formatMessage} = useIntl();
    const selectableChannels = useSelector(getMyPublicAndPrivateChannels);

    const onChange = (channels: Channel[], {action}: {action: string}) => {
        if (action === 'clear') {
            props.onChannelsSelected([]);
        } else {
            props.onChannelsSelected(channels.map((c) => c.id));
        }
    };

    const getOptionValue = (channel: Channel) => {
        return channel.id;
    };

    const formatOptionLabel = (channel: Channel) => {
        return (
            <React.Fragment>
                {channel.display_name || formatMessage({defaultMessage: 'Unknown Channel'})}
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

    const values = filterChannels(props.channelIds, selectableChannels);

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledSelect
            className={props.className}
            id={props.id}
            isMulti={true}
            controlShouldRenderValue={props.shouldRenderValue}
            options={selectableChannels}
            filterOption={filterOption}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={props.isClearable}
            value={values}
            placeholder={props.placeholder || formatMessage({defaultMessage: 'Select a channel'})}
            components={components}
            isDisabled={props.isDisabled}
            captureMenuScroll={props.captureMenuScroll}
        />
    );
};

export default ChannelSelector;
