// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {useDispatch, useSelector} from 'react-redux';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import styled from 'styled-components';

import {
    getAllChannels,
    getChannelsInTeam,
    getDirectAndGroupChannels,
    getMyChannelMemberships,
} from 'mattermost-redux/selectors/entities/channels';
import {IDMappedObjects, RelationOneToManyUnique, RelationOneToOne} from '@mattermost/types/utilities';
import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    GlobeIcon,
    LockIcon,
} from '@mattermost/compass-icons/components';
import General from 'mattermost-redux/constants/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {fetchChannelsAndMembers, getChannel} from 'mattermost-redux/actions/channels';

import {useIntl} from 'react-intl';

import {StyledSelect} from './styles';

export interface Props {
    id?: string;
    'data-testid'?: string;
    onChannelsSelected?: (channelIds: string[]) => void; // if isMulti=true
    onChannelSelected?: (channelId: string, channelName: string) => void; // if isMulti=false
    channelIds: string[];
    isClearable?: boolean;
    selectComponents?: SelectComponentsConfig<Channel, boolean>;
    isDisabled: boolean;
    captureMenuScroll: boolean;
    shouldRenderValue: boolean;
    placeholder?: string;
    teamId: string;
    isMulti: boolean;
    excludeDMGM?: boolean;
}

const getAllPublicChannelsInTeam = (teamId: string) => createSelector(
    'getAllPublicChannelsInTeam',
    getAllChannels,
    getChannelsInTeam,
    (allChannels: IDMappedObjects<Channel>, channelsByTeam: RelationOneToManyUnique<Team, Channel>): Channel[] => {
        const publicChannels : Channel[] = [];
        (channelsByTeam[teamId] || []).forEach((channelId: string) => {
            const channel = allChannels[channelId];
            if (channel.type === General.OPEN_CHANNEL && channel.delete_at === 0) {
                publicChannels.push(channel);
            }
        });
        return publicChannels;
    },
);

const getMyPublicAndPrivateChannelsInTeam = (teamId: string) => createSelector(
    'getMyPublicAndPrivateChannelsInTeam',
    getAllChannels,
    getChannelsInTeam,
    getMyChannelMemberships,
    (allChannels: IDMappedObjects<Channel>, channelsByTeam: RelationOneToManyUnique<Team, Channel>, myMembers: RelationOneToOne<Channel, ChannelMembership>): Channel[] => {
        const myChannels : Channel[] = [];
        (channelsByTeam[teamId] || []).forEach((channelId: string) => {
            if (Object.prototype.hasOwnProperty.call(myMembers, channelId)) {
                const channel = allChannels[channelId];
                if (channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL && channel.delete_at === 0) {
                    myChannels.push(channel);
                }
            }
        });
        return myChannels;
    },
);

// DM/GM channels with resolved display names — mattermost-redux's
// getDirectAndGroupChannels calls completeDirectChannelInfo internally,
// so DM channels get their partner's name as display_name (instead of being
// blank and falling through to the "Unknown Channel" fallback label).

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
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentTeamId = useSelector(getCurrentTeamId);

    // Get team channels - use run's team if available, otherwise current team
    const effectiveTeamId = props.teamId || currentTeamId;
    const teamChannels = useSelector(getMyPublicAndPrivateChannelsInTeam(effectiveTeamId));
    const allDmgmChannels = useSelector(getDirectAndGroupChannels);

    // mattermost-redux's getDirectAndGroupChannels does NOT filter manually
    // closed channels; we must drop them so closed DMs/GMs don't surface as
    // link targets in the selector.
    const dmgmChannels = useMemo(
        () => allDmgmChannels.filter((c) => c.delete_at === 0),
        [allDmgmChannels],
    );

    // Combine team channels and DM/GM channels for unified selection.
    // useMemo keeps array identity stable so the channel-fetch effect below
    // doesn't re-fire (and re-dispatch getChannel) on every render.
    const selectableChannels = useMemo(
        () => (props.excludeDMGM ? teamChannels : [...teamChannels, ...dmgmChannels]),
        [teamChannels, dmgmChannels, props.excludeDMGM],
    );
    const allPublicChannels = useSelector(getAllPublicChannelsInTeam(effectiveTeamId));

    useEffect(() => {
        if (effectiveTeamId && teamChannels.length === 0) {
            dispatch(fetchChannelsAndMembers(effectiveTeamId));
        }
    }, [effectiveTeamId, teamChannels.length, dispatch]);

    useEffect(() => {
        // Create a map with all channels in the store, keyed by channel ID
        const channelsMap = new Map<string, Channel>();
        [...allPublicChannels, ...selectableChannels].forEach((channel: Channel) => channelsMap.set(channel.id, channel));

        // For all channels not in the store initially, fetch them and add them to the store.
        // When excludeDMGM is set we skip channels that aren't in the map AND
        // aren't visible in dmgmChannels — they're DM/GM ids that this selector
        // is intentionally hiding, so fetching them just spins the wheel.
        const dmgmIds = new Set(dmgmChannels.map((c) => c.id));
        props.channelIds.forEach((channelID) => {
            if (channelsMap.has(channelID)) {
                return;
            }
            if (props.excludeDMGM && dmgmIds.has(channelID)) {
                return;
            }
            dispatch(getChannel(channelID));
        });
    }, [allPublicChannels, selectableChannels, dmgmChannels, props.channelIds, props.excludeDMGM, dispatch]);

    const onChangeMulti = (channels: Channel[], {action}: {action: string}) => {
        props.onChannelsSelected?.(action === 'clear' ? [] : channels.map((c) => c.id));
    };
    const onChange = (channel: Channel | Channel, {action}: {action: string}) => {
        props.onChannelSelected?.(action === 'clear' ? '' : channel.id, action === 'clear' ? '' : channel.display_name);
    };

    const getOptionValue = (channel: Channel) => {
        return channel.id;
    };

    const getChannelIcon = (channel: Channel) => {
        switch (channel.type) {
        case General.OPEN_CHANNEL:
            return <GlobeIcon size={12}/>;
        case General.PRIVATE_CHANNEL:
            return <LockIcon size={12}/>;
        case General.DM_CHANNEL:
            return <AccountOutlineIcon size={12}/>;
        case General.GM_CHANNEL:
            return <AccountMultipleOutlineIcon size={12}/>;
        default:
            return <GlobeIcon size={12}/>;
        }
    };

    const formatOptionLabel = (channel: Channel) => {
        return (
            <ChannelContainer>
                <ChanneIcon>
                    {getChannelIcon(channel)}
                </ChanneIcon>
                <ChannelDisplay>{channel.display_name || formatMessage({defaultMessage: 'Unknown Channel'})}</ChannelDisplay>
            </ChannelContainer>
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

    // When DMs/GMs are excluded as options, also strip them from the rendered
    // values. Otherwise a stale/pre-selected DM/GM id renders as a phantom
    // "Unknown Channel" pill (and triggers the fetch loop above).
    const allChannelsForValues = [...allPublicChannels, ...selectableChannels];
    const visibleChannelIds = props.excludeDMGM ? props.channelIds.filter((id) => {
        const ch = allChannelsForValues.find((c) => c.id === id);

        // Keep ids we don't know about yet — they could resolve to a non-DM/GM
        // channel once fetched. Drop only ids we positively know are DM/GM.
        return !ch || (ch.type !== General.DM_CHANNEL && ch.type !== General.GM_CHANNEL);
    }) : props.channelIds;
    const values = filterChannels(visibleChannelIds, allChannelsForValues);

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledSelect
            className={props.className}
            id={props.id}
            data-testid={props['data-testid']}
            isMulti={props.isMulti}
            controlShouldRenderValue={props.shouldRenderValue}
            options={selectableChannels}
            filterOption={filterOption}
            onChange={props.isMulti ? onChangeMulti : onChange}
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

const ChannelContainer = styled.div`
    display: flex;
    flex-direction: row;

`;
const ChanneIcon = styled.div`
    display: flex;
    align-self: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;
const ChannelDisplay = styled.div`
    overflow: hidden;
    margin-left: 4px;
    color: var(--center-channel-color);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
