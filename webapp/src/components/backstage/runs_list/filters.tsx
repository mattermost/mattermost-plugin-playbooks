// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import debounce from 'debounce';
import {ControlProps, components} from 'react-select';
import styled from 'styled-components';

import {FormattedMessage, useIntl} from 'react-intl';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {UserProfile} from '@mattermost/types/users';

import {useAppSelector} from 'src/hooks/redux';

import {FetchPlaybookRunsParams, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import ProfileSelector, {Option as ProfileOption} from 'src/components/profile/profile_selector';
import PlaybookSelector, {Option as PlaybookOption} from 'src/components/backstage/runs_list/playbook_selector';
import {Option as TeamOption} from 'src/components/team/team_selector';
import {clientFetchPlaybooks, fetchOwnersInTeam} from 'src/client';
import {
    Playbook,
    type StatusSchemeOption,
    resolveStatusScheme,
    splitStatusScheme,
} from 'src/types/playbook';
import SearchInput from 'src/components/backstage/search_input';
import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';
import {DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import Dropdown from 'src/components/dropdown';
import {FilterButton} from 'src/components/backstage/styles';

interface Props {
    fetchParams: FetchPlaybookRunsParams;
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>;
    fixedPlaybook?: boolean;
    fixedFinished?: boolean;
    statusScheme?: StatusSchemeOption[] | null;
}

const searchDebounceDelayMilliseconds = 300;

const ControlComponentAnchor = styled.a`
    position: relative;
    top: -4px;
    display: inline-block;
    margin: 0 0 8px 12px;
    font-size: 12px;
    font-weight: 600;
`;

const PlaybookRunListFilters = styled.div`
    display: flex;
    align-items: center;
    padding: 1rem 16px;
    gap: 4px;
`;

type ControlComponentProps = ControlProps<TeamOption, boolean> | ControlProps<ProfileOption, boolean> | ControlProps<PlaybookOption, boolean>;
const controlComponent = (ownProps: ControlComponentProps, filterName: string) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage
                    defaultMessage='Reset to all {filterName}'
                    values={{filterName}}
                />
            </ControlComponentAnchor>
        )}
    </div>
);

const OwnerControlComponent = (ownProps: ControlProps<ProfileOption, boolean>) => {
    return controlComponent(ownProps, 'owners');
};

const PlaybookControlComponent = (ownProps: ControlProps<PlaybookOption, boolean>) => {
    return controlComponent(ownProps, 'playbooks');
};

const Filters = ({fetchParams, setFetchParams, fixedPlaybook, fixedFinished, statusScheme}: Props) => {
    const {formatMessage} = useIntl();
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);
    const [playbookSelectorToggle, setPlaybookSelectorToggle] = useState(false);
    const currentTeamId = useAppSelector(getCurrentTeamId);

    const myRunsOnly = fetchParams.participant_or_follower_id === 'me';
    const setMyRunsOnly = (checked?: boolean) => {
        setFetchParams((oldParams) => {
            return {...oldParams, participant_or_follower_id: checked ? 'me' : '', page: 0};
        });
    };

    const setOwnerId = (user?: UserProfile) => {
        setFetchParams((oldParams) => {
            return {...oldParams, owner_user_id: user?.id, page: 0};
        });
    };

    const setPlaybookId = (playbookId?: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, playbook_id: playbookId, page: 0};
        });
    };

    const setFinishedRuns = (checked?: boolean) => {
        const statuses = checked ? [PlaybookRunStatus.InProgress, PlaybookRunStatus.Finished] : [PlaybookRunStatus.InProgress];
        setFetchParams((oldParams) => {
            return {...oldParams, statuses, page: 0};
        });
    };

    const setIncludeChecklists = (checked?: boolean) => {
        const types = checked ? [PlaybookRunType.Playbook, PlaybookRunType.ChannelChecklist] : [PlaybookRunType.Playbook];
        setFetchParams((oldParams) => {
            return {...oldParams, types, page: 0};
        });
    };

    const setStatusSlug = (slug?: string) => {
        setFetchParams((oldParams) => {
            return {
                ...oldParams,
                status_slugs: slug ? [slug] : undefined,
                page: 0,
            };
        });
    };

    const setSearchTerm = (term: string) => {
        setFetchParams((oldParams) => {
            return {...oldParams, search_term: term, page: 0};
        });
    };

    const resetOwner = () => {
        setOwnerId();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const resetPlaybook = () => {
        setPlaybookId();
        setPlaybookSelectorToggle(!playbookSelectorToggle);
    };

    async function fetchOwners() {
        const owners = await fetchOwnersInTeam(fetchParams.team_id || currentTeamId);
        return owners.map((c) => {
            //@ts-ignore TODO Fix this strangeness
            return {...c, id: c.user_id} as UserProfile;
        });
    }

    async function fetchPlaybooks() {
        const playbooks = await clientFetchPlaybooks(currentTeamId || '', {team_id: currentTeamId || '', sort: 'title'});
        return playbooks ? playbooks.items : [] as Playbook[];
    }

    const onSearch = useMemo(
        () => debounce(setSearchTerm, searchDebounceDelayMilliseconds),
        [setSearchTerm],
    );

    return (
        <PlaybookRunListFilters>
            <SearchInput
                testId={'search-filter'}
                default={fetchParams.search_term}
                onSearch={onSearch}
                placeholder={formatMessage({defaultMessage: 'Search'})}
            />
            <CheckboxInput
                testId={'my-runs-only'}
                text={formatMessage({defaultMessage: 'Mine only'})}
                checked={myRunsOnly}
                onChange={setMyRunsOnly}
            />
            {!fixedFinished && !statusScheme &&
                <CheckboxInput
                    testId={'finished-runs'}
                    text={formatMessage({defaultMessage: 'Include finished'})}
                    checked={(fetchParams.statuses?.length ?? 0) > 1}
                    onChange={setFinishedRuns}
                />
            }
            {statusScheme &&
                <StatusFilter
                    scheme={statusScheme}
                    selectedSlug={fetchParams.status_slugs?.[0]}
                    onSelect={setStatusSlug}
                />
            }
            {!fixedPlaybook &&
                <CheckboxInput
                    testId={'include-checklists'}
                    text={formatMessage({defaultMessage: 'Include checklists'})}
                    checked={(fetchParams.types?.length ?? 1) > 1}
                    onChange={setIncludeChecklists}
                />
            }
            <ProfileSelector
                testId={'owner-filter'}
                selectedUserId={fetchParams.owner_user_id}
                placeholder={formatMessage({defaultMessage: 'Owner'})}
                enableEdit={true}
                isClearable={true}
                customControl={OwnerControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(fetchParams.owner_user_id),
                    onCustomReset: resetOwner,
                }}
                controlledOpenToggle={profileSelectorToggle}
                getAllUsers={fetchOwners}
                onSelectedChange={setOwnerId}
            />
            {!fixedPlaybook &&
                <PlaybookSelector
                    testId={'playbook-filter'}
                    selectedPlaybookId={fetchParams.playbook_id}
                    placeholder={formatMessage({defaultMessage: 'Playbook'})}
                    enableEdit={true}
                    isClearable={true}
                    customControl={PlaybookControlComponent}
                    customControlProps={{
                        showCustomReset: Boolean(fetchParams.playbook_id),
                        onCustomReset: resetPlaybook,
                    }}
                    controlledOpenToggle={playbookSelectorToggle}
                    getPlaybooks={fetchPlaybooks}
                    onSelectedChange={setPlaybookId}
                />
            }
        </PlaybookRunListFilters>
    );
};

interface StatusFilterProps {
    scheme: StatusSchemeOption[];
    selectedSlug?: string;
    onSelect: (slug?: string) => void;
}

const StatusFilter = ({scheme, selectedSlug, onSelect}: StatusFilterProps) => {
    const {formatMessage} = useIntl();
    const [isOpen, setOpen] = useState(false);
    const options = resolveStatusScheme(scheme);
    const {open, closed} = splitStatusScheme(options);
    const selected = options.find((opt) => opt.slug === selectedSlug);
    const label = selected?.name ?? formatMessage({defaultMessage: 'Status'});

    const choose = (slug?: string) => {
        setOpen(false);
        onSelect(slug);
    };

    const trigger = (
        <FilterButton
            data-testid='status-filter'
            $active={isOpen || Boolean(selectedSlug)}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen((openState) => !openState);
            }}
        >
            {label}
            <i className='icon-chevron-down icon--small'/>
        </FilterButton>
    );

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setOpen}
            placement='bottom-start'
            target={trigger}
        >
            <DropdownMenu
                data-testid='status-filter-menu'
                role='listbox'
                aria-label={formatMessage({defaultMessage: 'Filter by status'})}
            >
                <DropdownMenuItem onClick={() => choose()}>
                    {formatMessage({defaultMessage: 'All statuses'})}
                </DropdownMenuItem>
                <FilterGroupLabel>{formatMessage({defaultMessage: 'Open'})}</FilterGroupLabel>
                {open.map((opt) => (
                    <DropdownMenuItem
                        key={opt.slug}
                        onClick={() => choose(opt.slug)}
                    >
                        {opt.name}
                    </DropdownMenuItem>
                ))}
                <FilterGroupLabel>{formatMessage({defaultMessage: 'Closed'})}</FilterGroupLabel>
                {closed.map((opt) => (
                    <DropdownMenuItem
                        key={opt.slug}
                        onClick={() => choose(opt.slug)}
                    >
                        {opt.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenu>
        </Dropdown>
    );
};

const FilterGroupLabel = styled.div`
    padding: 6px 20px 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

export default Filters;
