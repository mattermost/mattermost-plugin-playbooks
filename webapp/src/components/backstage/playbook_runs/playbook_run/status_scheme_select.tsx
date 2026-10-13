// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {CheckIcon} from '@mattermost/compass-icons/components';

import {setRunStatus} from 'src/client';
import {ToastStyle} from 'src/components/backstage/toast';
import {useToaster} from 'src/components/backstage/toast_banner';
import {DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import Dropdown from 'src/components/dropdown';
import {type StatusSchemeOption, resolveStatusScheme, splitStatusScheme} from 'src/types/playbook';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

interface Props {
    playbookRun: PlaybookRun;
    scheme?: StatusSchemeOption[] | null;
    disabled?: boolean;
    flush?: boolean;
}

const StatusSchemeSelect = ({playbookRun, scheme, disabled, flush}: Props) => {
    const {formatMessage} = useIntl();
    const toaster = useToaster();
    const options = resolveStatusScheme(scheme);
    const {open: openOptions, closed: closedOptions} = splitStatusScheme(options);
    const currentSlug = playbookRun.status_slug || (playbookRun.current_status === PlaybookRunStatus.Finished ? 'closed' : 'in_progress');
    const [selectedSlug, setSelectedSlug] = useState(currentSlug);
    const [pending, setPending] = useState(false);
    const [isOpen, setOpen] = useState(false);

    useEffect(() => {
        setSelectedSlug(currentSlug);
    }, [currentSlug]);

    const selected = options.find((option) => option.slug === selectedSlug);
    const selectedCategory = selected?.category || 'open';
    const label = selected?.name || currentSlug;
    const onSelect = useCallback(async (slug: string) => {
        setOpen(false);
        if (!slug || slug === selectedSlug) {
            return;
        }
        const previous = selectedSlug;
        setSelectedSlug(slug);
        setPending(true);
        const result = await setRunStatus(playbookRun.id, slug);
        setPending(false);
        if (result?.error) {
            setSelectedSlug(previous);
            toaster.add({
                content: formatMessage({defaultMessage: 'Unable to change run status.'}),
                toastStyle: ToastStyle.Failure,
            });
        }
    }, [formatMessage, playbookRun.id, selectedSlug, toaster]);

    const trigger = (
        <StatusPill
            type='button'
            data-testid='run-status-select'
            aria-label={formatMessage({defaultMessage: 'Run status: {name}'}, {name: label})}
            aria-haspopup={disabled ? undefined : 'listbox'}
            aria-expanded={disabled ? undefined : isOpen}
            title={label}
            disabled={disabled || pending}
            $category={selectedCategory}
            $flush={Boolean(flush)}
            onClick={(event) => {
                if (disabled || pending) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                setOpen((open) => !open);
            }}
        >
            <StatusLabel>{label}</StatusLabel>
            {disabled ? null : (
                <i
                    className='icon icon-chevron-down'
                    aria-hidden={true}
                />
            )}
        </StatusPill>
    );

    if (disabled) {
        return trigger;
    }

    const renderOption = (option: StatusSchemeOption) => {
        const isSelected = option.slug === selectedSlug;
        return (
            <DropdownMenuItem
                key={option.slug}
                onClick={() => onSelect(option.slug)}
                data-testid={`run-status-option-${option.slug}`}
            >
                <OptionRow>
                    <span>{option.name}</span>
                    {isSelected ? (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg)'
                        />
                    ) : null}
                </OptionRow>
            </DropdownMenuItem>
        );
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setOpen}
            placement='bottom-start'
            target={trigger}
        >
            <StyledMenu
                data-testid='run-status-menu'
                role='listbox'
                aria-label={formatMessage({defaultMessage: 'Run status'})}
            >
                <GroupLabel>{formatMessage({defaultMessage: 'Open'})}</GroupLabel>
                {openOptions.map(renderOption)}
                <GroupLabel>{formatMessage({defaultMessage: 'Closed'})}</GroupLabel>
                {closedOptions.map(renderOption)}
            </StyledMenu>
        </Dropdown>
    );
};

export default StatusSchemeSelect;

const StatusPill = styled.button<{$category: 'open' | 'closed'; $flush: boolean}>`
    display: inline-flex;
    max-width: 220px;
    height: 24px;
    align-items: center;
    gap: 2px;
    padding: 0 4px 0 8px;
    border: none;
    border-radius: 4px;
    margin-left: ${({$flush}) => ($flush ? 0 : '8px')};
    background: ${({$category}) => ($category === 'open' ? 'var(--sidebar-text-active-border)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
    color: var(--button-color);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    white-space: nowrap;

    &:hover:not(:disabled) {
        opacity: 0.88;
    }

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
    }

    &:disabled {
        cursor: default;
        opacity: 1;
        padding-right: 8px;
    }

    i {
        margin: 0;
        font-size: 14px;
    }
`;

const StatusLabel = styled.span`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const StyledMenu = styled(DropdownMenu)`
    min-width: 200px;
    padding: 8px 0;
`;

const GroupLabel = styled.div`
    padding: 6px 20px 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const OptionRow = styled.span`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
`;
