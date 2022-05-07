import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

import ReactSelect, {StylesConfig, ValueType} from 'react-select';
import {useSelector} from 'react-redux';
import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import General from 'mattermost-redux/constants/general';

import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {useIntl} from 'react-intl';

import {useClientRect} from 'src/hooks';
import Dropdown from 'src/components/dropdown';

import {Placeholder} from './update_timer_selector';

export interface Props {
    id?: string;
    onChannelsSelected: (channelIds: string[]) => void;
    channelIds: string[];
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

const sortChannels = (allChannels: Channel[], selectedChannelIds: string[]): Channel[] => {
    const selectedChannels: Channel[] = [];
    const otherChannels: Channel[] = [];
    for (let i = 0; i < allChannels.length; i++) {
        if (selectedChannelIds.indexOf(allChannels[i].id) === -1) {
            otherChannels.push(allChannels[i]);
        } else {
            selectedChannels.push(allChannels[i]);
        }
    }
    return [...selectedChannels, ...otherChannels];
};

const BroadcastChannels = (props: Props) => {
    const {formatMessage} = useIntl();
    const selectableChannels = sortChannels(useSelector(getMyPublicAndPrivateChannels), props.channelIds);

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        moveRect(rect, selectableChannels.length, setMoveUp);
    }, [rect, selectableChannels.length]);

    const n = props.channelIds.length;
    const nChannels = String(n) + ' channel' + (n === 1 ? '' : 's');
    const target = (
        <div ref={ref}>
            <div onClick={toggleOpen}>
                <Placeholder label={nChannels}/>
            </div>
        </div>
    );

    const getOptionValue = (channel: Channel) => {
        return channel.id;
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

    const handleChannel = (id: string) => {
        const idx = props.channelIds.indexOf(id);
        if (idx === -1) {
            props.onChannelsSelected([...props.channelIds, id]);
        } else {
            props.onChannelsSelected([...props.channelIds.slice(0, idx), ...props.channelIds.slice(idx + 1)]);
        }
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={target}
            showOnRight={false}
            moveUp={moveUp}
        >
            <StyledReactSelect
                autoFocus={true}
                closeMenuOnSelect={false}
                controlShouldRenderValue={false}
                menuIsOpen={true}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
                id={props.id}
                isMulti={false}
                options={selectableChannels}
                filterOption={filterOption}
                onChange={(option: ValueType<Channel, boolean>) => handleChannel((option as Channel).id)}
                getOptionValue={getOptionValue}
                formatOptionLabel={(option: Channel) => (
                    <ChannelLabel
                        channel={option}
                        selected={props.channelIds.some((channelId: string) => channelId === option.id)}
                    />
                )}
                value={values}
                placeholder={props.placeholder || formatMessage({defaultMessage: 'Search for a channel'})}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                isDisabled={false}
                styles={selectStyles}
                captureMenuScroll={false}
            />
        </Dropdown>
    );
};

export const moveRect = (rect: DOMRect, length: number, moveUp: React.Dispatch<React.SetStateAction<number>>) => {
    if (!rect) {
        moveUp(0);
        return;
    }

    const innerHeight = window.innerHeight;
    const numProfilesShown = Math.min(6, length);
    const spacePerProfile = 48;
    const dropdownYShift = 27;
    const dropdownReqSpace = 80;
    const extraSpace = 10;
    const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numProfilesShown * spacePerProfile) + extraSpace;
    moveUp(Math.max(0, dropdownBottom - innerHeight));
};

// styles for the select component
const selectStyles: StylesConfig<Channel, boolean> = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none', width: '340px'}),
    option: (provided) => {
        return {
            ...provided,
            backgroundColor: 'var(--center-channel-bg)',
            color: 'unset',
        };
    },
};

export default BroadcastChannels;

const StyledReactSelect = styled(ReactSelect)`
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;    
    color: var(--center-channel-color);
`;

interface ChannelLabelProps {
    channel: Channel;
    selected: boolean | undefined;
}

const ChannelLabel = (props: ChannelLabelProps) => {
    const {formatMessage} = useIntl();

    return (
        <React.Fragment>
            {props.channel.display_name || formatMessage({defaultMessage: 'Unknown Channel'})}
            {props.selected && <CheckIcon className={'icon icon-check'}/>}
        </React.Fragment>
    );
};

const CheckIcon = styled.i`
    color: var(--button-bg);
	font-size: 22px;
    position: absolute;
    right: 0;
`;
