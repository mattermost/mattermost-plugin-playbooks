// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {
    DragDropContext,
    Draggable,
    DropResult,
    Droppable,
} from '@hello-pangea/dnd';

import {CustomPhase} from 'src/types/playbook';

export const MAX_CUSTOM_PHASES = 20;
export const MAX_CUSTOM_PHASE_TITLE_LENGTH = 64;

// Phase ids look like the ones the server makes (26 letters and digits).
const ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const newPhaseId = () => Array.from({length: 26}, () => ID_CHARACTERS[Math.floor(Math.random() * ID_CHARACTERS.length)]).join('');

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Props {
    phases: CustomPhase[];
    disabled?: boolean;
    onChange: (phases: CustomPhase[]) => void;
}

// The phases of a playbook that does not use its task lists as phases: type a name and add it, then drag
// the list into the order the phases come in.
const CustomPhasesEditor = ({phases, disabled = false, onChange}: Props) => {
    const {formatMessage} = useIntl();
    const [draft, setDraft] = useState('');
    const trimmed = draft.trim();
    const duplicate = trimmed !== '' && phases.some((phase) => sameTitle(phase.title, trimmed));
    const full = phases.length >= MAX_CUSTOM_PHASES;
    const canAdd = !disabled && trimmed !== '' && !duplicate && !full;

    const add = () => {
        if (!canAdd) {
            return;
        }
        onChange([...phases, {id: newPhaseId(), title: trimmed}]);
        setDraft('');
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index) {
            return;
        }
        const reordered = [...phases];
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);
        onChange(reordered);
    };

    const rename = (phase: CustomPhase, title: string) => {
        const next = title.trim();
        if (next === '' || next === phase.title || phases.some((other) => other.id !== phase.id && sameTitle(other.title, next))) {
            return false;
        }
        onChange(phases.map((other) => (other.id === phase.id ? {...other, title: next} : other)));
        return true;
    };

    return (
        <Container data-testid='custom-phases-editor'>
            <AddRow>
                <Input
                    data-testid='custom-phase-input'
                    value={draft}
                    disabled={disabled || full}
                    maxLength={MAX_CUSTOM_PHASE_TITLE_LENGTH}
                    placeholder={formatMessage({defaultMessage: 'Add a phase'})}
                    aria-label={formatMessage({defaultMessage: 'Phase name'})}
                    aria-invalid={duplicate}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <AddButton
                    type='button'
                    data-testid='custom-phase-add'
                    disabled={!canAdd}
                    onClick={add}
                    aria-label={formatMessage({defaultMessage: 'Add phase'})}
                >
                    <i className='icon icon-plus'/>
                </AddButton>
            </AddRow>
            {duplicate && (
                <Hint role='alert'>
                    {formatMessage({defaultMessage: 'There is already a phase with this name.'})}
                </Hint>
            )}
            {full && (
                <Hint>
                    {formatMessage({defaultMessage: 'A playbook can have up to {max} phases.'}, {max: MAX_CUSTOM_PHASES})}
                </Hint>
            )}

            {phases.length === 0 ? (
                <Hint data-testid='custom-phases-empty'>
                    {formatMessage({defaultMessage: 'No phases yet. Runs will not show a phase timeline until you add some.'})}
                </Hint>
            ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId='custom-phases'>
                        {(droppable) => (
                            <List
                                {...droppable.droppableProps}
                                ref={droppable.innerRef}
                            >
                                {phases.map((phase, index) => (
                                    <Draggable
                                        key={phase.id}
                                        draggableId={phase.id}
                                        index={index}
                                        isDragDisabled={disabled}
                                    >
                                        {(draggable, snapshot) => (
                                            <Row
                                                data-testid='custom-phase-row'
                                                ref={draggable.innerRef}
                                                {...draggable.draggableProps}
                                                $dragging={snapshot.isDragging}
                                            >
                                                <Handle
                                                    {...draggable.dragHandleProps}
                                                    aria-label={formatMessage({defaultMessage: 'Drag to reorder phase {title}'}, {title: phase.title})}
                                                    $disabled={disabled}
                                                >
                                                    <i className='icon icon-drag-vertical'/>
                                                </Handle>
                                                <Position aria-hidden={true}>{index + 1}</Position>
                                                <PhaseName
                                                    phase={phase}
                                                    disabled={disabled}
                                                    onRename={(title) => rename(phase, title)}
                                                />
                                                <RemoveButton
                                                    type='button'
                                                    disabled={disabled}
                                                    aria-label={formatMessage({defaultMessage: 'Delete phase {title}'}, {title: phase.title})}
                                                    onClick={() => onChange(phases.filter((other) => other.id !== phase.id))}
                                                >
                                                    <i className='icon icon-close'/>
                                                </RemoveButton>
                                            </Row>
                                        )}
                                    </Draggable>
                                ))}
                                {droppable.placeholder}
                            </List>
                        )}
                    </Droppable>
                </DragDropContext>
            )}
        </Container>
    );
};

// A phase's name, edited in place: Enter or leaving the field saves it, Escape or an invalid name puts
// the old one back.
const PhaseName = ({phase, disabled, onRename}: {phase: CustomPhase, disabled: boolean, onRename: (title: string) => boolean}) => {
    const {formatMessage} = useIntl();
    const [draft, setDraft] = useState<string | null>(null);

    const commit = () => {
        if (draft !== null) {
            onRename(draft);
        }
        setDraft(null);
    };

    return (
        <NameInput
            data-testid='custom-phase-name'
            value={draft ?? phase.title}
            disabled={disabled}
            maxLength={MAX_CUSTOM_PHASE_TITLE_LENGTH}
            aria-label={formatMessage({defaultMessage: 'Phase name'})}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                } else if (e.key === 'Escape') {
                    setDraft(null);
                }
            }}
        />
    );
};

const Container = styled.div`
    display: flex;
    max-width: 480px;
    flex-direction: column;
    margin-top: 12px;
    gap: 8px;
`;

const AddRow = styled.div`
    display: flex;
    gap: 8px;
`;

const fieldStyles = `
    height: 36px;
    box-sizing: border-box;
    padding: 0 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;

    &:focus {
        border-color: var(--button-bg);
        box-shadow: inset 0 0 0 1px var(--button-bg);
        outline: none;
    }

    &:disabled {
        opacity: 0.56;
    }
`;

const Input = styled.input`
    ${fieldStyles}
    flex: 1;

    &[aria-invalid='true'] {
        border-color: var(--error-text);
    }
`;

const AddButton = styled.button`
    display: flex;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--button-bg);
    color: var(--button-color);
    cursor: pointer;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
        cursor: not-allowed;
    }
`;

const Hint = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 12px;
`;

const List = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Row = styled.div<{$dragging: boolean}>`
    display: flex;
    align-items: center;
    padding: 2px 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: ${({$dragging}) => ($dragging ? '0 8px 24px rgba(var(--center-channel-color-rgb), 0.12)' : 'none')};
    gap: 4px;
`;

const Handle = styled.div<{$disabled: boolean}>`
    display: flex;
    width: 24px;
    height: 32px;
    align-items: center;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: ${({$disabled}) => ($disabled ? 'default' : 'grab')};

    &:focus-visible {
        border-radius: 4px;
        outline: 2px solid var(--button-bg);
    }
`;

const Position = styled.span`
    min-width: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    text-align: right;
`;

const NameInput = styled.input`
    flex: 1;
    height: 32px;
    box-sizing: border-box;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--center-channel-color);
    font-size: 14px;

    &:hover:not(:disabled) {
        border-color: rgba(var(--center-channel-color-rgb), 0.16);
    }

    &:focus {
        border-color: var(--button-bg);
        background: var(--center-channel-bg);
        outline: none;
    }
`;

const RemoveButton = styled.button`
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;

    &:hover:not(:disabled) {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    }
`;

export default CustomPhasesEditor;
