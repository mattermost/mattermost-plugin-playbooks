import React, {FC} from 'react';
import {OptionsType} from 'react-select';
import {useSelector} from 'react-redux';
import {getMyChannels, getChannel} from 'mattermost-redux/selectors/entities/channels';

import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {Playbook} from 'src/types/playbook';

import {StyledAsyncSelect} from './styles';

export interface Props {
    onChannelSelected: (channelID: string | null) => void;
    playbook: Playbook;
    isClearable?: boolean;
}

const ChannelSelector: FC<Props> = (props: Props) => {
    const selectableChannels = useSelector(getMyChannels);

    type GetChannelType = (channelID: string) => Channel
    const getChannelFromID = useSelector<GlobalState, GetChannelType>((state) => (channelID) => getChannel(state, channelID) || {display_name: 'Unknown Channel', id: channelID});

    const onChange = (channel: Channel | null) => {
        props.onChannelSelected(channel ? channel.id : null);
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
        callback(selectableChannels);
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
            isClearable={props.isClearable}
            value={getChannelFromID(props.playbook.broadcast_channel_id)}
            placeholder={'Select a channel'}
            classNamePrefix='channel-selector'
        />
    );
};

export default ChannelSelector;
