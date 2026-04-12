// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import InfiniteScroll from 'react-infinite-scroll-component';

import {FetchPlaybookRunsParams, PlaybookRun} from 'src/types/playbook_run';

import LoadingSpinner from 'src/components/assets/loading_spinner';

import {
    ATTRIBUTE_COLUMNS_STORAGE_KEY,
    AttributeColumnsConfig,
    DEFAULT_MAX_COLUMNS,
    stableFieldId,
} from './attribute_columns';
import Row from './row';
import RunListHeader from './run_list_header';
import Filters from './filters';

interface Props {
    playbookRuns: PlaybookRun[]
    totalCount: number
    fetchParams: FetchPlaybookRunsParams
    setFetchParams: React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>
    filterPill: React.ReactNode | null
    fixedTeam?: boolean
    fixedPlaybook?: boolean
}

const PlaybookRunList = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.90);
    font-family: 'Open Sans', sans-serif;
`;

const Footer = styled.div`
    margin: 10px 0 20px;
    font-size: 14px;
`;

const Count = styled.div`
    width: 100%;
    padding-top: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-align: center;
`;

const SpinnerContainer = styled.div`
    overflow: visible;
    width: 100%;
    height: 24px;
    margin-top: 10px;
    text-align: center;
`;

const StyledSpinner = styled(LoadingSpinner)`
    width: auto;
    height: 100%;
`;

const ConfigureRow = styled.div`
    padding: 4px 0 4px 15px;
`;

const RunList = ({
    playbookRuns,
    totalCount,
    fetchParams,
    setFetchParams,
    filterPill,
    fixedTeam,
    fixedPlaybook,
}: Props) => {
    const isFiltering = (
        (fetchParams?.search_term?.length ?? 0) > 0 ||
        (fetchParams?.statuses?.length ?? 0) > 1 ||
        (fetchParams?.owner_user_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_id?.length ?? 0) > 0 ||
        (fetchParams?.participant_or_follower_id?.length ?? 0) > 0 ||
        (fetchParams?.property_value_filter?.length ?? 0) > 0
    );

    // Collect property fields from the first run that has them (for the configure columns panel).
    // Column configuration applies to the entire list view, not per-row.
    const configFields = useMemo(() => {
        const firstRunWithFields = playbookRuns.find((r) => r.property_fields && r.property_fields.length > 0);
        return firstRunWithFields?.property_fields ?? [];
    }, [playbookRuns]);

    // Use a per-playbook storage key when all visible runs share the same playbook; global otherwise.
    // An explicit playbook filter (fetchParams.playbook_id) is treated as a single-playbook context
    // regardless of how many different playbooks appear in the currently-loaded page of results.
    const {storageKey, isSinglePlaybook} = useMemo(() => {
        if (fetchParams?.playbook_id) {
            return {
                storageKey: `${ATTRIBUTE_COLUMNS_STORAGE_KEY}-${fetchParams.playbook_id}`,
                isSinglePlaybook: true,
            };
        }
        if (!playbookRuns.length) {
            return {storageKey: ATTRIBUTE_COLUMNS_STORAGE_KEY, isSinglePlaybook: false};
        }
        const ids = new Set(playbookRuns.map((r) => r.playbook_id));
        const single = ids.size === 1;
        return {
            storageKey: single ? `${ATTRIBUTE_COLUMNS_STORAGE_KEY}-${[...ids][0]}` : ATTRIBUTE_COLUMNS_STORAGE_KEY,
            isSinglePlaybook: single,
        };
    }, [playbookRuns, fetchParams?.playbook_id]);

    // null = never configured (show defaults), string[] = explicit user selection (even if empty)
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[] | null>(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed) || !parsed.every((v: unknown) => typeof v === 'string')) {
                    return null;
                }
                return parsed as string[];
            }
        } catch {
            // ignore parse errors
        }
        return null;
    });

    // When storageKey changes (e.g. after data loads and the per-playbook key becomes available),
    // re-read the selection from the new key.
    const prevStorageKeyRef = useRef(storageKey);
    useEffect(() => {
        if (storageKey === prevStorageKeyRef.current) {
            return;
        }
        prevStorageKeyRef.current = storageKey;
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (!Array.isArray(parsed) || !parsed.every((v: unknown) => typeof v === 'string')) {
                    setSelectedFieldIds(null);
                    return;
                }
                setSelectedFieldIds(parsed as string[]);
                return;
            }
        } catch {
            // ignore parse errors
        }
        setSelectedFieldIds(null);
    }, [storageKey]);

    const handleSelectionChange = useCallback((ids: string[]) => {
        setSelectedFieldIds(ids);
        localStorage.setItem(storageKey, JSON.stringify(ids));
    }, [storageKey]);

    // When no explicit selection (null), default to the first DEFAULT_MAX_COLUMNS fields.
    // An explicit empty array [] means the user deselected everything — show no columns.
    const effectiveSelectedIds = useMemo(() => {
        if (selectedFieldIds !== null) {
            return selectedFieldIds;
        }
        if (configFields.length === 0) {
            return [];
        }
        const sorted = [...configFields].sort((a, b) => (a.attrs.sort_order ?? 0) - (b.attrs.sort_order ?? 0));
        return sorted.slice(0, DEFAULT_MAX_COLUMNS).map((f) => stableFieldId(f));
    }, [selectedFieldIds, configFields]);

    const nextPage = () => {
        setFetchParams((oldParam: FetchPlaybookRunsParams) => ({...oldParam, page: oldParam.page + 1}));
    };

    return (
        <PlaybookRunList
            id='playbookRunList'
            data-testid='playbookRunList'
            className='PlaybookRunList'
        >
            <Filters
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
                fixedPlaybook={fixedPlaybook}
            />
            {filterPill}
            <RunListHeader
                fetchParams={fetchParams}
                setFetchParams={setFetchParams}
            />
            {isSinglePlaybook && configFields.length > 0 && (
                <ConfigureRow>
                    <AttributeColumnsConfig
                        propertyFields={configFields}
                        selectedFieldIds={effectiveSelectedIds}
                        onSelectionChange={handleSelectionChange}
                    />
                </ConfigureRow>
            )}
            {playbookRuns.length === 0 && !isFiltering &&
                <div className='text-center pt-8'>
                    <FormattedMessage defaultMessage='There are no runs for this playbook.'/>
                </div>
            }
            {playbookRuns.length === 0 && isFiltering &&
                <div className='text-center pt-8'>
                    <FormattedMessage defaultMessage='There are no runs matching those filters.'/>
                </div>
            }
            <InfiniteScroll
                dataLength={playbookRuns.length}
                next={nextPage}
                hasMore={playbookRuns.length < totalCount}
                loader={<SpinnerContainer><StyledSpinner/></SpinnerContainer>}
                scrollableTarget={'playbooks-backstageRoot'}
            >
                {playbookRuns.map((playbookRun) => (
                    <Row
                        key={playbookRun.id}
                        playbookRun={playbookRun}
                        fixedTeam={fixedTeam}
                        selectedFieldIds={isSinglePlaybook ? effectiveSelectedIds : undefined}
                    />
                ))}
            </InfiniteScroll>
            <Footer>
                <Count>
                    <FormattedMessage
                        defaultMessage='{total, number} total'
                        values={{total: totalCount}}
                    />
                </Count>
            </Footer>
        </PlaybookRunList>
    );
};

export default RunList;
