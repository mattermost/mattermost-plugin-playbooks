// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {
    DragDropContext,
    Draggable,
    type DraggableProvided,
    type DropResult,
    Droppable,
} from 'react-beautiful-dnd';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {clientFetchPlaybook, savePlaybook} from 'src/client';
import {TertiaryButton} from 'src/components/assets/buttons';
import {ToastStyle} from 'src/components/backstage/toast';
import {useToaster} from 'src/components/backstage/toast_banner';
import {
    DefaultStatusScheme,
    PlaybookWithChecklist,
    StatusSchemeOption,
    isValidStatusSlug,
    joinStatusScheme,
    resolveStatusScheme,
    slugFromName,
    splitStatusScheme,
} from 'src/types/playbook';

interface Props {
    playbook: PlaybookWithChecklist;
    canEdit: boolean;
    onSaved?: () => void;
}

const uniqueSlug = (base: string, used: Set<string>) => {
    let slug = base || 'status';
    let n = 2;
    while (used.has(slug)) {
        slug = `${base || 'status'}_${n}`;
        n += 1;
    }
    return slug;
};

const SectionStatusScheme = ({playbook, canEdit, onSaved}: Props) => {
    const {formatMessage} = useIntl();
    const toaster = useToaster();
    const [scheme, setScheme] = useState<StatusSchemeOption[]>(() => resolveStatusScheme(playbook.status_scheme));
    const [saving, setSaving] = useState(false);
    const [autoSlugs, setAutoSlugs] = useState<Set<string>>(() => new Set());

    const persist = async (next: StatusSchemeOption[]) => {
        const previous = scheme;
        setScheme(next);
        if (!canEdit) {
            return;
        }
        setSaving(true);
        try {
            const latest = await clientFetchPlaybook(playbook.id);
            if (!latest) {
                throw new Error('Unable to fetch latest playbook before save');
            }
            await savePlaybook({...latest, status_scheme: next});
            onSaved?.();
        } catch {
            setScheme(previous);
            toaster.add({
                content: formatMessage({defaultMessage: 'Unable to save status options.'}),
                toastStyle: ToastStyle.Failure,
            });
        } finally {
            setSaving(false);
        }
    };

    const {open, closed} = splitStatusScheme(scheme);

    const addOption = (category: StatusSchemeOption['category']) => {
        const name = category === 'open' ? formatMessage({defaultMessage: 'New open status'}) : formatMessage({defaultMessage: 'New close reason'});
        const slug = uniqueSlug(slugFromName(name), new Set(scheme.map((opt) => opt.slug)));
        setAutoSlugs((prev) => new Set(prev).add(slug));
        const nextOpen = category === 'open' ? [...open, {slug, name, category, order: 0}] : open;
        const nextClosed = category === 'closed' ? [...closed, {slug, name, category, order: 0}] : closed;
        persist(joinStatusScheme(nextOpen, nextClosed));
    };

    const replaceInCategory = (slug: string, updater: (opt: StatusSchemeOption) => StatusSchemeOption) => {
        const updateList = (list: StatusSchemeOption[]) => list.map((opt) => (opt.slug === slug ? updater(opt) : opt));
        persist(joinStatusScheme(updateList(open), updateList(closed)));
    };

    const rename = (slug: string, name: string, nextSlug?: string) => {
        replaceInCategory(slug, (opt) => {
            const updated = {...opt, name};
            if (nextSlug && autoSlugs.has(slug) && isValidStatusSlug(nextSlug)) {
                updated.slug = nextSlug;
            }
            return updated;
        });
        if (nextSlug && autoSlugs.has(slug) && nextSlug !== slug && isValidStatusSlug(nextSlug)) {
            setAutoSlugs((prev) => {
                const next = new Set(prev);
                next.delete(slug);
                next.add(nextSlug);
                return next;
            });
        }
    };

    const changeSlug = (slug: string, nextSlug: string) => {
        setAutoSlugs((prev) => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
        });
        replaceInCategory(slug, (opt) => ({...opt, slug: nextSlug}));
    };

    const remove = (slug: string) => {
        persist(joinStatusScheme(
            open.filter((opt) => opt.slug !== slug),
            closed.filter((opt) => opt.slug !== slug),
        ));
    };

    const move = (slug: string, delta: number) => {
        const opt = scheme.find((item) => item.slug === slug);
        if (!opt) {
            return;
        }
        const list = opt.category === 'open' ? [...open] : [...closed];
        const index = list.findIndex((item) => item.slug === slug);
        const nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= list.length) {
            return;
        }
        const [removed] = list.splice(index, 1);
        list.splice(nextIndex, 0, removed);
        persist(joinStatusScheme(
            opt.category === 'open' ? list : open,
            opt.category === 'closed' ? list : closed,
        ));
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.droppableId !== result.destination.droppableId) {
            return;
        }
        if (result.source.index === result.destination.index) {
            return;
        }
        const list = result.source.droppableId === 'open' ? [...open] : [...closed];
        const [removed] = list.splice(result.source.index, 1);
        list.splice(result.destination.index, 0, removed);
        persist(joinStatusScheme(
            result.source.droppableId === 'open' ? list : open,
            result.source.droppableId === 'closed' ? list : closed,
        ));
    };

    const reset = () => {
        setAutoSlugs(new Set());
        persist(DefaultStatusScheme.map((opt) => ({...opt})));
    };
    const usedSlugs = new Set(scheme.map((opt) => opt.slug));

    return (
        <Container data-testid='status-scheme-editor'>
            <Help>
                {formatMessage({defaultMessage: 'Names are shown on runs. The slug is generated from the name until you edit it. Changing a slug does not update existing runs.'})}
            </Help>
            <HeaderRow>
                <HandleSpacer/>
                <HandleSpacer/>
                <NameHeader>{formatMessage({defaultMessage: 'Name'})}</NameHeader>
                <SlugHeader>{formatMessage({defaultMessage: 'Slug'})}</SlugHeader>
                <ActionsSpacer/>
            </HeaderRow>
            <DragDropContext onDragEnd={onDragEnd}>
                <StatusGroup
                    category='open'
                    title={formatMessage({defaultMessage: 'Open'})}
                    hint={formatMessage({defaultMessage: 'Run stays in progress'})}
                    options={open}
                    canEdit={canEdit}
                    saving={saving}
                    usedSlugs={usedSlugs}
                    autoSlugs={autoSlugs}
                    addLabel={formatMessage({defaultMessage: 'Add open status'})}
                    onAdd={() => addOption('open')}
                    onRename={rename}
                    onChangeSlug={changeSlug}
                    onRemove={remove}
                    onMove={move}
                />
                <StatusGroup
                    category='closed'
                    title={formatMessage({defaultMessage: 'Closed'})}
                    hint={formatMessage({defaultMessage: 'Finishes the run'})}
                    options={closed}
                    canEdit={canEdit}
                    saving={saving}
                    usedSlugs={usedSlugs}
                    autoSlugs={autoSlugs}
                    addLabel={formatMessage({defaultMessage: 'Add close reason'})}
                    onAdd={() => addOption('closed')}
                    onRename={rename}
                    onChangeSlug={changeSlug}
                    onRemove={remove}
                    onMove={move}
                />
            </DragDropContext>
            {canEdit && (
                <Actions>
                    <TertiaryButton
                        onClick={reset}
                        disabled={saving}
                    >
                        {formatMessage({defaultMessage: 'Reset to default'})}
                    </TertiaryButton>
                </Actions>
            )}
        </Container>
    );
};

interface GroupProps {
    category: StatusSchemeOption['category'];
    title: string;
    hint: string;
    options: StatusSchemeOption[];
    canEdit: boolean;
    saving: boolean;
    usedSlugs: Set<string>;
    autoSlugs: Set<string>;
    addLabel: string;
    onAdd: () => void;
    onRename: (slug: string, name: string, nextSlug?: string) => void;
    onChangeSlug: (slug: string, nextSlug: string) => void;
    onRemove: (slug: string) => void;
    onMove: (slug: string, delta: number) => void;
}

const StatusGroup = ({
    category,
    title,
    hint,
    options,
    canEdit,
    saving,
    usedSlugs,
    autoSlugs,
    addLabel,
    onAdd,
    onRename,
    onChangeSlug,
    onRemove,
    onMove,
}: GroupProps) => {
    const {formatMessage} = useIntl();

    return (
        <Group $category={category}>
            <GroupHeader>
                <CategoryChip $category={category}>{title}</CategoryChip>
                <GroupHint>{hint}</GroupHint>
            </GroupHeader>
            <Droppable
                droppableId={category}
                type={category}
                isDropDisabled={!canEdit}
            >
                {(provided) => (
                    <RowList
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {options.map((opt, index) => (
                            <Draggable
                                key={opt.slug}
                                draggableId={opt.slug}
                                index={index}
                                isDragDisabled={!canEdit || saving}
                            >
                                {(dragProvided) => (
                                    <StatusSchemeRow
                                        option={opt}
                                        canEdit={canEdit}
                                        saving={saving}
                                        canRemove={options.length > 1}
                                        isFirst={index === 0}
                                        isLast={index === options.length - 1}
                                        usedSlugs={usedSlugs}
                                        autoSlug={autoSlugs.has(opt.slug)}
                                        dragProvided={dragProvided}
                                        onRename={onRename}
                                        onChangeSlug={onChangeSlug}
                                        onRemove={onRemove}
                                        onMove={onMove}
                                    />
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </RowList>
                )}
            </Droppable>
            {canEdit && (
                <AddButton
                    onClick={onAdd}
                    disabled={saving}
                >
                    <i className='icon icon-plus'/>
                    {addLabel}
                </AddButton>
            )}
            {options.length === 0 && (
                <EmptyGroup>
                    {formatMessage({defaultMessage: 'Add at least one option in this group.'})}
                </EmptyGroup>
            )}
        </Group>
    );
};

interface RowProps {
    option: StatusSchemeOption;
    canEdit: boolean;
    saving: boolean;
    canRemove: boolean;
    isFirst: boolean;
    isLast: boolean;
    usedSlugs: Set<string>;
    autoSlug: boolean;
    dragProvided: DraggableProvided;
    onRename: (slug: string, name: string, nextSlug?: string) => void;
    onChangeSlug: (slug: string, nextSlug: string) => void;
    onRemove: (slug: string) => void;
    onMove: (slug: string, delta: number) => void;
}

const StatusSchemeRow = ({
    option,
    canEdit,
    saving,
    canRemove,
    isFirst,
    isLast,
    usedSlugs,
    autoSlug,
    dragProvided,
    onRename,
    onChangeSlug,
    onRemove,
    onMove,
}: RowProps) => {
    const {formatMessage} = useIntl();
    const [slugError, setSlugError] = useState('');
    const [nameValue, setNameValue] = useState(option.name);
    const [slugValue, setSlugValue] = useState(option.slug);

    useEffect(() => {
        setNameValue(option.name);
        setSlugValue(option.slug);
    }, [option.name, option.slug]);

    const commitName = (value: string) => {
        const name = value.trim();
        if (!name) {
            setNameValue(option.name);
            setSlugValue(option.slug);
            return;
        }
        if (name === option.name && (!autoSlug || slugValue === option.slug)) {
            return;
        }
        onRename(option.slug, name, autoSlug ? slugValue : undefined);
    };

    const onNameChange = (value: string) => {
        setNameValue(value);
        if (autoSlug) {
            const used = new Set(usedSlugs);
            used.delete(option.slug);
            setSlugValue(uniqueSlug(slugFromName(value), used));
        }
    };

    const commitSlug = (value: string) => {
        const nextSlug = value.trim().toLowerCase();
        if (nextSlug === option.slug) {
            setSlugError('');
            return;
        }
        if (!isValidStatusSlug(nextSlug)) {
            setSlugError(formatMessage({defaultMessage: 'Use lowercase letters, numbers, and underscores.'}));
            return;
        }
        if (usedSlugs.has(nextSlug)) {
            setSlugError(formatMessage({defaultMessage: 'This slug is already used.'}));
            return;
        }
        setSlugError('');
        onChangeSlug(option.slug, nextSlug);
    };

    return (
        <Row
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
            data-testid={`status-scheme-row-${option.slug}`}
        >
            {canEdit ? (
                <DragHandle
                    type='button'
                    className='icon icon-drag-vertical'
                    title={formatMessage({defaultMessage: 'Drag to reorder'})}
                    aria-label={formatMessage({defaultMessage: 'Drag to reorder'})}
                    {...dragProvided.dragHandleProps}
                />
            ) : (
                <HandleSpacer/>
            )}
            <MoveGroup>
                <IconButton
                    type='button'
                    aria-label={formatMessage({defaultMessage: 'Move up'})}
                    disabled={!canEdit || saving || isFirst}
                    onClick={() => onMove(option.slug, -1)}
                >
                    <i className='icon icon-chevron-up'/>
                </IconButton>
                <IconButton
                    type='button'
                    aria-label={formatMessage({defaultMessage: 'Move down'})}
                    disabled={!canEdit || saving || isLast}
                    onClick={() => onMove(option.slug, 1)}
                >
                    <i className='icon icon-chevron-down'/>
                </IconButton>
            </MoveGroup>
            <Fields>
                <NameInput
                    id={`status-scheme-name-${option.slug}`}
                    data-testid={`status-scheme-name-${option.slug}`}
                    aria-label={formatMessage({defaultMessage: 'Status name'})}
                    value={nameValue}
                    disabled={!canEdit || saving}
                    onChange={(event) => onNameChange(event.target.value)}
                    onBlur={(event) => commitName(event.target.value)}
                />
                <SlugField>
                    <SlugInput
                        id={`status-scheme-slug-${option.slug}`}
                        data-testid={`status-scheme-slug-${option.slug}`}
                        aria-label={formatMessage({defaultMessage: 'Status slug'})}
                        aria-invalid={Boolean(slugError)}
                        aria-describedby={slugError ? `status-scheme-slug-error-${option.slug}` : undefined}
                        value={slugValue}
                        disabled={!canEdit || saving}
                        spellCheck={false}
                        onChange={(event) => setSlugValue(event.target.value)}
                        onBlur={(event) => commitSlug(event.target.value)}
                    />
                    {slugError && (
                        <FieldError id={`status-scheme-slug-error-${option.slug}`}>
                            {slugError}
                        </FieldError>
                    )}
                </SlugField>
            </Fields>
            {canEdit && (
                <IconButton
                    type='button'
                    $danger={true}
                    aria-label={formatMessage({defaultMessage: 'Remove {name}'}, {name: option.name})}
                    disabled={saving || !canRemove}
                    title={canRemove ? undefined : formatMessage({defaultMessage: 'Keep at least one option in this group.'})}
                    onClick={() => onRemove(option.slug)}
                >
                    <i className='icon icon-close'/>
                </IconButton>
            )}
        </Row>
    );
};

export default SectionStatusScheme;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Help = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 0 0 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
    font-weight: 600;
`;

const NameHeader = styled.span`
    flex: 1;
`;

const SlugHeader = styled.span`
    width: 180px;
    flex: 0 0 180px;
`;

const HandleSpacer = styled.span`
    width: 28px;
    flex: 0 0 28px;
`;

const ActionsSpacer = styled.span`
    width: 28px;
    flex: 0 0 28px;
`;

const Group = styled.section<{$category: StatusSchemeOption['category']}>`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-left: 3px solid ${({$category}) => ($category === 'open' ? 'var(--sidebar-text-active-border)' : 'rgba(var(--center-channel-color-rgb), 0.48)')};
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
`;

const GroupHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const CategoryChip = styled.span<{$category: StatusSchemeOption['category']}>`
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 4px;
    background: ${({$category}) => ($category === 'open' ? 'var(--sidebar-text-active-border)' : 'rgba(var(--center-channel-color-rgb), 0.64)')};
    color: var(--button-color);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 20px;
    text-transform: uppercase;
    white-space: nowrap;
`;

const GroupHint = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const RowList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Row = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
`;

const DragHandle = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.48);
    cursor: grab;

    &:hover {
        color: var(--center-channel-color);
    }
`;

const MoveGroup = styled.div`
    display: flex;
    flex-direction: column;
`;

const IconButton = styled.button<{$danger?: boolean}>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: ${({$danger}) => ($danger ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    cursor: pointer;

    &:hover:not(:disabled) {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: ${({$danger}) => ($danger ? 'var(--error-text)' : 'var(--center-channel-color)')};
    }

    &:disabled {
        opacity: 0.32;
        cursor: default;
    }
`;

const Fields = styled.div`
    display: flex;
    flex: 1;
    gap: 8px;
    min-width: 0;
`;

const NameInput = styled.input`
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
`;

const SlugField = styled.div`
    display: flex;
    flex-direction: column;
    width: 180px;
    flex: 0 0 180px;
    gap: 4px;
`;

const SlugInput = styled.input`
    height: 32px;
    padding: 0 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    color: var(--center-channel-color);
    font-family: monospace;
    font-size: 12px;
`;

const FieldError = styled.div`
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
`;

const AddButton = styled(TertiaryButton)`
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    height: 32px;
    padding: 0 12px;
    gap: 4px;
`;

const EmptyGroup = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;
