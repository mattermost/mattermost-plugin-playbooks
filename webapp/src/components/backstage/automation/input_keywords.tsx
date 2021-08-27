// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {StylesConfig} from 'react-select';

import CreatableSelect from 'react-select/creatable';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/automation/styles';
import {Toggle} from 'src/components/backstage/automation/toggle';

interface Props {
    enabled: boolean;
    textOnToggle: string;
    onToggle: () => void;
    placeholderText: string;
    keywords: string[];
    onKeywordsChange: (keywords: string[]) => void;
}
const selectComponents = {
    DropdownIndicator: null,
    ClearIndicator: null,
};

const createOption = (label: string) => ({
    label,
    value: label,
});

export const InputKeywords = (props: Props) => {
    const [inputValue, setInputValue] = useState('');
    const [values, setValues] = useState(props.keywords.map(createOption));

    const handleChange = (value: any) => {
        let newValues: {label: string, value: string}[] = value;
        if (!value) {
            newValues = [];
        }
        setValues(newValues);
        props.onKeywordsChange(newValues.map((item) => item.value));
    };

    const handleInputChange = (newInputValue: string) => {
        setInputValue(newInputValue);
    };

    const inputKeyDown = (e: React.KeyboardEvent) => {
        if (!inputValue) {
            return;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
            const keywords = values.map((item) => item.value);
            if (keywords.includes(inputValue)) {
                return;
            }
            setInputValue('');
            setValues([...values, createOption(inputValue)]);
            e.preventDefault();
            props.onKeywordsChange([...keywords, inputValue]);
        }
    };

    return (
        <KeywordsAutomationHeader>
            <KeywordsAutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                />
                <div>{props.textOnToggle}</div>
            </KeywordsAutomationTitle>
            <KeywordsSelectorWrapper>
                <CreatableSelect
                    components={selectComponents}
                    isDisabled={!props.enabled}
                    inputValue={inputValue}
                    isClearable={true}
                    isMulti={true}
                    menuIsOpen={false}
                    placeholder={props.placeholderText}
                    value={props.enabled ? values : []}
                    onKeyDown={inputKeyDown}
                    onChange={handleChange}
                    onInputChange={handleInputChange}
                    styles={selectStyles}
                />
            </KeywordsSelectorWrapper>
        </KeywordsAutomationHeader>
    );
};

// styles for the select component
const selectStyles: StylesConfig = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
};

const KeywordsAutomationHeader = styled(AutomationHeader)`
    align-items: flex-start;
`;

const KeywordsAutomationTitle = styled(AutomationTitle)`
    margin: 8px 0px 8px 0px;
`;

const KeywordsSelectorWrapper = styled(SelectorWrapper)`
    height: 100%;
`;
