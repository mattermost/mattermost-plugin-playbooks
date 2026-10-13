// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {type StatusSchemeOption, resolveStatusScheme, splitStatusScheme} from 'src/types/playbook';

interface StatusCount {
    slug: string;
    count: number;
}

interface Props {
    counts: StatusCount[];
    scheme?: StatusSchemeOption[] | null;
    selectedSlug?: string;
    onSelect: (slug?: string) => void;
}

const StatusBreakdown = ({counts, scheme, selectedSlug, onSelect}: Props) => {
    const {formatMessage} = useIntl();
    const options = resolveStatusScheme(scheme);
    const {open, closed} = splitStatusScheme(options);
    const countBySlug = new Map(counts.map((item) => [item.slug, item.count]));
    const rows = [...open, ...closed].map((opt) => ({
        ...opt,
        count: countBySlug.get(opt.slug) ?? 0,
    }));
    counts.forEach((item) => {
        if (!rows.some((row) => row.slug === item.slug)) {
            rows.push({
                slug: item.slug,
                name: item.slug,
                category: 'open',
                order: rows.length,
                count: item.count,
            });
        }
    });
    const total = rows.reduce((sum, row) => sum + row.count, 0);

    return (
        <Container>
            <Title>{formatMessage({defaultMessage: 'RUNS by status'})}</Title>
            <List>
                {rows.map((row) => {
                    const percent = total > 0 ? (row.count / total) * 100 : 0;
                    const selected = selectedSlug === row.slug;
                    return (
                        <Row
                            key={row.slug}
                            type='button'
                            $selected={selected}
                            aria-pressed={selected}
                            aria-label={formatMessage(
                                {defaultMessage: '{name}: {count} {count, plural, one {run} other {runs}}'},
                                {name: row.name, count: row.count},
                            )}
                            onClick={() => onSelect(selected ? undefined : row.slug)}
                        >
                            <Name>{row.name}</Name>
                            <Track>
                                <Fill
                                    $category={row.category}
                                    style={{width: `${percent}%`}}
                                />
                            </Track>
                            <Count>{row.count}</Count>
                        </Row>
                    );
                })}
            </List>
        </Container>
    );
};

export default StatusBreakdown;

const Container = styled.section`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    padding: 12px 16px 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.32);
`;

const Title = styled.h3`
    margin: 0 0 8px;
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 16px;
    text-transform: uppercase;
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Row = styled.button<{$selected: boolean}>`
    display: grid;
    grid-template-columns: minmax(72px, 140px) 1fr 32px;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    background: ${({$selected}) => ($selected ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: var(--center-channel-color);
    cursor: pointer;
    text-align: left;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
    }
`;

const Name = styled.span`
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Track = styled.span`
    display: block;
    overflow: hidden;
    height: 8px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.12);
`;

const Fill = styled.span<{$category: StatusSchemeOption['category']}>`
    display: block;
    height: 100%;
    border-radius: 4px;
    background: ${({$category}) => ($category === 'open' ? 'var(--sidebar-text-active-border)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
`;

const Count = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-align: right;
`;
