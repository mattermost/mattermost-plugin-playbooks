// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import styled from 'styled-components';

import PostText from 'src/components/post_text';
import {useClickOutsideRef, useKeyPress} from 'src/hooks/general';

interface DescriptionProps {
    value: string;
    onEdit: (value: string) => void;
}

const RHSAboutDescription = (props: DescriptionProps) => {
    const placeholder = 'Add a description...';

    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value);

    const textareaRef = useRef(null);

    const saveAndClose = () => {
        const newValue = editedValue.trim();
        setEditedValue(newValue);
        props.onEdit(newValue);
        setEditing(false);
    };

    useClickOutsideRef(textareaRef, saveAndClose);
    useKeyPress((e: KeyboardEvent) => e.ctrlKey && e.key === 'Enter', saveAndClose);

    useEffect(() => {
        setEditedValue(props.value);
    }, [props.value]);

    if (!editing) {
        return (

            <RenderedDescription
                onClick={(event) => {
                    // Enter edit mode only if the user is not clicking a link
                    const targetNode = event.target as Node;
                    if (targetNode.nodeName !== 'A') {
                        setEditing(true);
                    }
                }}
            >
                {editedValue ? (
                    <PostText text={editedValue}/>
                ) : (
                    <PlaceholderText>{placeholder}</PlaceholderText>
                )}
            </RenderedDescription>
        );
    }

    const computeHeight = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = '5px';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    return (
        <DescriptionTextArea
            value={editedValue}
            placeholder={placeholder}
            ref={textareaRef}
            onChange={(e) => setEditedValue(e.target.value)}
            autoFocus={true}
            onFocus={(e) => {
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
                computeHeight(e);
            }}
            onInput={computeHeight}
        />
    );
};

const DescriptionTextArea = styled.textarea`
    resize: none;
    width: 100%;
    height: max-content;
    padding: 4px 8px;
    margin-top: -2px;
    margin-bottom: 9px;

    border: none;
    border-radius: 5px;
    box-shadow: none;

    background: rgba(var(--center-channel-color-rgb), 0.04);

    &:focus {
        box-shadow: none;
    }

    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

const PlaceholderText = styled.span`
    opacity: 0.5;
`;

const RenderedDescription = styled.div`
    margin-bottom: 16px;
    padding: 2px 8px;

    line-height: 20px;

    border-radius: 5px;

    :hover {
        cursor: text;
    }

    white-space: pre-wrap;
`;

export default RHSAboutDescription;
