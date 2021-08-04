// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import styled, {StyledComponent} from 'styled-components';

import {useClickOutsideRef, useKeyPress} from 'src/hooks/general';

interface Props {
    onEdit: (newTitle: string) => void;
    value: string;
    renderedTitle?: StyledComponent<'div', any, {}, never>;
}

const RHSAboutTitle = (props: Props) => {
    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value);

    const invalidValue = editedValue.length < 2;

    const inputRef = useRef(null);

    useEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    const saveAndClose = () => {
        if (!invalidValue) {
            props.onEdit(editedValue);
            setEditing(false);
        }
    };

    const discardAndClose = () => {
        setEditedValue(props.value);
        setEditing(false);
    };

    useClickOutsideRef(inputRef, saveAndClose);
    useKeyPress('Enter', saveAndClose);
    useKeyPress('Escape', discardAndClose);

    if (!editing) {
        const RenderedTitle = props.renderedTitle ?? DefaultRenderedTitle;

        return (
            <RenderedTitle onClick={() => setEditing(true)} >
                {editedValue}
            </RenderedTitle>
        );
    }

    return (
        <>
            <TitleInput
                type={'text'}
                ref={inputRef}
                onChange={(e) => setEditedValue(e.target.value)}
                value={editedValue}
                maxLength={59}
                autoFocus={true}
                onFocus={(e) => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                }}
            />
            {invalidValue &&
            <ErrorMessage>
                {'Run name must have at least two characters'}
            </ErrorMessage>
            }
        </>
    );
};

const TitleInput = styled.input`
    width: calc(100% - 75px);
    height: 30px;
    padding: 4px 8px;
    margin-bottom: 5px;
    margin-top: -3px;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }

    color: var(--center-channel-color);
    font-size: 18px;
    line-height: 24px;
    font-weight: 600;
`;

const ErrorMessage = styled.div`
    color: var(--dnd-indicator);

    font-size: 12px;
    line-height: 16px;

    margin-bottom: 12px;
    margin-left: 8px;
`;

export const DefaultRenderedTitle = styled.div`
    padding: 0 8px;

    max-width: 100%;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    height: 30px;
    line-height: 24px;

    font-size: 18px;
    font-weight: 600;

    color: var(--center-channel-color);

    :hover {
        cursor: text;
    }

    border-radius: 5px;

    margin-bottom: 2px;
`;

export default RHSAboutTitle;
