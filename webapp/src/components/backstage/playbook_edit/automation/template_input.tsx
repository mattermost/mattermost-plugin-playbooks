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
import ReactSelect, {StylesConfig, ValueType} from 'react-select';
import {useIntl} from 'react-intl';

import {SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import {SYSTEM_TOKENS, buildTemplatePreview} from 'src/utils/template_utils';

const TOKEN_LABELS: Record<string, {id: string; defaultMessage: string}> = {
    SEQ: {id: 'playbooks.template_input.seq_token', defaultMessage: "'{SEQ}' — Sequential ID"},
    OWNER: {id: 'playbooks.template_input.owner_token', defaultMessage: "'{OWNER}' — Run owner"},
    CREATOR: {id: 'playbooks.template_input.creator_token', defaultMessage: "'{CREATOR}' — Run creator"},
};

type TokenOption = {
    value: string;
    label: string;
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
}

const selectStyles: StylesConfig<TokenOption, false> = {
    control: (provided) => ({...provided, minWidth: 200, margin: 0, borderRadius: 4}),
    menu: (provided) => ({...provided, width: 260}),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isFocused ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent',
        color: 'var(--center-channel-color)',
        fontSize: '13px',
    }),
};

export const TemplateInput = ({enabled, placeholderText, input, onChange, onBlur, fieldNames, maxLength, prefix, testId}: Props) => {
    const {formatMessage} = useIntl();
    const systemTokenOptions = useMemo<TokenOption[]>(() =>
        [...SYSTEM_TOKENS].map((token) => ({
            value: token,
            label: TOKEN_LABELS[token] ? formatMessage(TOKEN_LABELS[token]) : `{${token}}`,
            isSystem: true,
        })),
    [formatMessage]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const fieldOptions = useMemo<TokenOption[]>(() => fieldNames.map((name) => ({
        value: name,
        label: `{${name}}`,
        isSystem: false,
    })), [fieldNames]);

    const allOptions = useMemo<TokenOption[]>(() => [
        ...systemTokenOptions,
        ...fieldOptions,
    ], [systemTokenOptions, fieldOptions]);

    const unknownFields = useMemo(() => {
        const knownUpper = new Set([
            ...[...SYSTEM_TOKENS].map((t) => t.toUpperCase()),
            ...fieldNames.map((n) => n.toUpperCase()),
        ]);
        const unknown: string[] = [];
        for (const match of input.matchAll(/\{([^}]+)\}/g)) {
            if (!knownUpper.has(match[1].trim().toUpperCase())) {
                unknown.push(match[1].trim());
            }
        }
        return unknown;
    }, [input, fieldNames]);

    const fieldNamesUpperSet = useMemo(() => new Set(fieldNames.map((n) => n.toUpperCase())), [fieldNames]);

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

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === '{') {
            setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
            setShowDropdown(true);
        }
    }, []);

    const handleSelect = useCallback((selected: ValueType<TokenOption, false>) => {
        const option = selected as TokenOption | null | undefined;
        if (!option) {
            setShowDropdown(false);
            return;
        }

        const token = `{${option.value}}`;

        // Insert at cursor position, replacing the opening { that triggered the dropdown
        const before = input.slice(0, cursorPos);
        const after = input.slice(cursorPos + 1); // skip the { that was already typed
        const newValue = before + token + after;

        onChange(newValue);
        setShowDropdown(false);

        // Restore focus to input after selection
        if (focusTimeoutRef.current) {
            clearTimeout(focusTimeoutRef.current);
        }
        focusTimeoutRef.current = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = before.length + token.length;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    }, [cursorPos, input, onChange]);

    const handleContainerBlur = useCallback(() => {
        if (blurTimeoutRef.current !== undefined) {
            clearTimeout(blurTimeoutRef.current);
        }
        blurTimeoutRef.current = setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
                setShowDropdown(false);
                onBlur?.();
            }
        }, 0);
    }, [onBlur]);

    useEffect(() => {
        return () => {
            if (focusTimeoutRef.current !== undefined) {
                clearTimeout(focusTimeoutRef.current);
            }
            if (blurTimeoutRef.current !== undefined) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

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
                />
                {showDropdown && enabled && (
                    <DropdownContainer>
                        <ReactSelect
                            autoFocus={true}
                            options={allOptions}
                            menuIsOpen={true}
                            controlShouldRenderValue={false}
                            placeholder={formatMessage({id: 'playbooks.template_input.search_placeholder', defaultMessage: 'Search tokens...'})}
                            styles={selectStyles}
                            components={{DropdownIndicator: null, IndicatorSeparator: null}}
                            onChange={handleSelect}
                            tabSelectsValue={true}
                        />
                    </DropdownContainer>
                )}
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

const DropdownContainer = styled.div`
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10;
    margin-top: 4px;
    background: var(--center-channel-bg);
    border-radius: 4px;
    box-shadow: var(--elevation-4, 0 4px 16px rgba(0 0 0 / 0.12));
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
    background: rgba(var(--error-text-color-rgb), 0.08);
    color: var(--error-text);
    font-size: 12px;
`;
