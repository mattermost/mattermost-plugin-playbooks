import React from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {useSelector} from 'react-redux';
import {getMyChannels, getChannel} from 'mattermost-redux/selectors/entities/channels';
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
    channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL,
);

type GetChannelType = (channelID: string) => Channel

const ChannelSelector = (props: Props & { className?: string }) => {
    const {formatMessage} = useIntl();
    const selectableChannels = useSelector(getMyPublicAndPrivateChannels);

    const getChannelFromID = useSelector<GlobalState, GetChannelType>((state) => (channelID) => getChannel(state, channelID) || {display_name: 'Unknown Channel', id: channelID});

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

    const values = props.channelIds?.map(getChannelFromID);

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
            classNamePrefix='channel-selector'
            components={components}
            isDisabled={props.isDisabled}
            captureMenuScroll={props.captureMenuScroll}
        />
    );
};

export default ChannelSelector;
