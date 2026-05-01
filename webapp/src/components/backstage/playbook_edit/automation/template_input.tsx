// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {SYSTEM_TOKENS, buildTemplatePreview, extractTemplateFieldNames} from 'src/utils/template_utils';

const TOKEN_DESCRIPTIONS: Record<string, {id: string; defaultMessage: string}> = {
    SEQ: {id: 'playbooks.template_input.seq_desc', defaultMessage: 'Sequential ID'},
    OWNER: {id: 'playbooks.template_input.owner_desc', defaultMessage: 'Run owner'},
    CREATOR: {id: 'playbooks.template_input.creator_desc', defaultMessage: 'Run creator'},
};

type TokenOption = {
    value: string;
    description: string;
    isSystem: boolean;
};

interface Props {
    enabled: boolean;
    placeholderText: string;
    input: string;
    onChange: (updatedInput: string) => void;
    onBlur?: () => void;
    fieldNames: string[];
    maxLength?: number;
    prefix?: string;
    testId?: string;
    openInsertToggle?: number;
}

export const TemplateInput = ({enabled, placeholderText, input, onChange, onBlur, fieldNames, maxLength, prefix, testId, openInsertToggle}: Props) => {
    const {formatMessage} = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const cursorPosRef = useRef(0);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Track whether the suggestion list is open and where the `{` trigger started
    const [triggerPos, setTriggerPos] = useState<number | null>(null);
    const [insertMode, setInsertMode] = useState(false);

    const systemTokenOptions = useMemo<TokenOption[]>(() =>
        [...SYSTEM_TOKENS].map((token) => ({
            value: token,
            description: TOKEN_DESCRIPTIONS[token] ? formatMessage(TOKEN_DESCRIPTIONS[token]) : '',
            isSystem: true,
        })),
    [formatMessage]);

    const fieldOptions = useMemo<TokenOption[]>(() => fieldNames.map((name) => ({
        value: name,
        description: '',
        isSystem: false,
    })), [fieldNames]);

    const allOptions = useMemo<TokenOption[]>(() => [
        ...systemTokenOptions,
        ...fieldOptions,
    ], [systemTokenOptions, fieldOptions]);

    const query = triggerPos === null ? '' : input.slice(triggerPos + 1, cursorPosRef.current);

    const filteredOptions = useMemo(() => {
        if (triggerPos === null) {
            return [];
        }
        return allOptions.filter((opt) => opt.value.toLowerCase().includes(query.toLowerCase()));
    }, [triggerPos, allOptions, query]);

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredOptions]);

    const fieldNamesUpperSet = useMemo(() => new Set(fieldNames.map((n) => n.toUpperCase())), [fieldNames]);

    const unknownFields = useMemo(() => {
        return extractTemplateFieldNames(input).filter((name) => !fieldNamesUpperSet.has(name.toUpperCase()));
    }, [input, fieldNamesUpperSet]);

    const previewText = useMemo(() => {
        if (!input) {
            return '';
        }
        const ownerFallback = formatMessage({id: 'playbooks.template_preview.owner_fallback', defaultMessage: "Owner's name"});
        const creatorFallback = formatMessage({id: 'playbooks.template_preview.creator_fallback', defaultMessage: "Creator's name"});
        return buildTemplatePreview(input, [], {}, {prefix, ownerFallback, creatorFallback})
            .replace(/\{([^}]+)\}/g, (match, inner: string) =>
                (fieldNamesUpperSet.has(inner.trim().toUpperCase()) ? `[${inner.trim()}]` : match),
            );
    }, [input, fieldNamesUpperSet, prefix, formatMessage]);

    const closeSuggestions = useCallback(() => {
        setTriggerPos(null);
        setInsertMode(false);
        setSelectedIndex(0);
    }, []);

    const acceptOption = useCallback((option: TokenOption) => {
        const token = `{${option.value}}`;

        if (triggerPos === null) {
            return;
        }

        let before: string;
        let after: string;
        if (insertMode) {
            // Insert-button mode — no `{` was typed, insert at triggerPos
            before = input.slice(0, triggerPos);
            after = input.slice(triggerPos);
        } else {
            // Keyboard mode — replace from the `{` through the partial query
            before = input.slice(0, triggerPos);
            after = input.slice(triggerPos + 1 + query.length);
        }

        const newValue = before + token + after;
        onChange(newValue);
        closeSuggestions();

        // Restore focus and cursor
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = before.length + token.length;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    }, [input, triggerPos, insertMode, query, onChange, closeSuggestions]);

    const findTrigger = useCallback((val: string, cursor: number): number | null => {
        for (let i = cursor - 1; i >= 0; i--) {
            if (val[i] === '}') {
                return null; // closed — no trigger
            }
            if (val[i] === '{') {
                return i;
            }
        }
        return null;
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        cursorPosRef.current = cursor;
        onChange(val);

        // Detect or dismiss the trigger on every keystroke
        if (insertMode) {
            return;
        }
        const pos = findTrigger(val, cursor);
        if (pos === null) {
            setTriggerPos(null);
            setSelectedIndex(0);
        } else {
            setTriggerPos(pos);
        }
    }, [onChange, insertMode, findTrigger]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (triggerPos !== null && filteredOptions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => ((prev - 1) + filteredOptions.length) % filteredOptions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                acceptOption(filteredOptions[selectedIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSuggestions();
            }
        }
    }, [triggerPos, filteredOptions, selectedIndex, acceptOption, closeSuggestions]);

    // Handle the external insert-variable button toggle
    const prevToggleRef = useRef(openInsertToggle);
    useEffect(() => {
        if (openInsertToggle !== undefined && openInsertToggle !== prevToggleRef.current) {
            prevToggleRef.current = openInsertToggle;
            const pos = inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0;
            setTriggerPos(pos);
            setInsertMode(true);
            setSelectedIndex(0);
            inputRef.current?.focus();
        }
    }, [openInsertToggle]); // eslint-disable-line react-hooks/exhaustive-deps -- read live DOM value, no need to react to `input` changes

    const handleContainerBlur = useCallback(() => {
        if (blurTimeoutRef.current !== undefined) {
            clearTimeout(blurTimeoutRef.current);
        }
        blurTimeoutRef.current = setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
                closeSuggestions();
                onBlur?.();
            }
        }, 0);
    }, [onBlur, closeSuggestions]);

    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current !== undefined) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const showSuggestions = triggerPos !== null && enabled && filteredOptions.length > 0;
    const suggestionsId = testId ? `${testId}-suggestions-listbox` : 'template-suggestions';

    return (
        <SelectorWrapper>
            <InputContainer
                ref={containerRef}
                onBlur={handleContainerBlur}
            >
                <TextBox
                    ref={inputRef}
                    disabled={!enabled}
                    type='text'
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholderText}
                    maxLength={maxLength}
                    data-testid={testId ? `${testId}-input` : undefined}
                    role='combobox'
                    aria-label={placeholderText}
                    aria-expanded={showSuggestions}
                    aria-autocomplete='list'
                    aria-controls={suggestionsId}
                    aria-activedescendant={showSuggestions ? `${suggestionsId}-${selectedIndex}` : undefined}
                />
                <SuggestionList
                    role='listbox'
                    id={suggestionsId}
                    hidden={!showSuggestions}
                    data-testid={testId ? `${testId}-suggestions` : undefined}
                >
                    {filteredOptions.map((opt, i) => (
                        <SuggestionItem
                            key={opt.value}
                            id={`${suggestionsId}-${i}`}
                            role='option'
                            aria-selected={i === selectedIndex}
                            $selected={i === selectedIndex}
                            onMouseDown={(e) => {
                                e.preventDefault(); // keep focus in input
                                acceptOption(opt);
                            }}
                            onMouseEnter={() => setSelectedIndex(i)}
                            data-testid={testId ? `${testId}-suggestion-${opt.value}` : undefined}
                        >
                            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- displaying template token syntax, not translatable text */}
                            <TokenName>{`{${opt.value}}`}</TokenName>
                            {opt.description && <TokenDesc>{opt.description}</TokenDesc>}
                        </SuggestionItem>
                    ))}
                </SuggestionList>
            </InputContainer>
            {input && (
                <Preview data-testid={testId ? `${testId}-preview` : undefined}>
                    <PreviewLabel>{formatMessage({id: 'playbooks.template_input.preview_label', defaultMessage: 'Preview: '})}</PreviewLabel>
                    <PreviewText>{previewText}</PreviewText>
                </Preview>
            )}
            {unknownFields.length > 0 && (
                <Warning data-testid={testId ? `${testId}-warning` : undefined}>
                    {formatMessage({id: 'playbooks.template_input.unknown_fields_warning', defaultMessage: 'Unknown field references: {fields}'}, {fields: unknownFields.join(', ')})}
                </Warning>
            )}
        </SelectorWrapper>
    );
};

const InputContainer = styled.div`
    position: relative;
    width: 100%;
`;

const SuggestionList = styled.ul`
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    margin: 4px 0 0;
    padding: 4px 0;
    list-style: none;
    background: var(--center-channel-bg);
    border-radius: 4px;
    box-shadow: var(--elevation-4, 0 4px 16px rgba(0 0 0 / 0.12));
    max-height: 200px;
    overflow-y: auto;
`;

const SuggestionItem = styled.li<{$selected: boolean}>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    background: ${({$selected}) => ($selected ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }
`;

const TokenName = styled.span`
    font-weight: 600;
    color: var(--center-channel-color);
`;

const TokenDesc = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
`;

const TextBox = styled.input<{disabled: boolean}>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    background: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.04)' : 'var(--center-channel-bg)')};
    height: 40px;
    width: 100%;
    color: var(--center-channel-color);
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;

    ${(props) => !props.disabled && props.value && css`
        :invalid:not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);
        }
    `}
`;

const Preview = styled.div`
    display: flex;
    align-items: center;
    margin-top: 4px;
    font-size: 12px;
    line-height: 16px;
`;

const PreviewLabel = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 4px;
`;

const PreviewText = styled.span`
    color: var(--center-channel-color);
`;

const Warning = styled.div`
    display: flex;
    align-items: center;
    margin-top: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(var(--error-text-rgb), 0.08);
    color: var(--error-text);
    font-size: 12px;
`;
