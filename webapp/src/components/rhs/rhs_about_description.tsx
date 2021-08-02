// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import styled from 'styled-components';

import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import PostText from 'src/components/post_text';
import {useClickOutsideRef, useKeyPress} from 'src/hooks/general';

interface DescriptionProps {
    value: string;
    onEdit: (value: string) => void;
}

const RHSAboutDescription = (props: DescriptionProps) => {
    const placeholder = 'No description yet. Click here to edit it.';

    const [editing, setEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(props.value || placeholder);

    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

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
        setEditedValue(props.value || placeholder);
    }, [props.value]);

    if (!editing) {
        return (
            <RenderedDescription onClick={() => setEditing(true)}>
                <PostText
                    text={editedValue}
                    team={currentTeam}
                />
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

const RenderedDescription = styled.div`
    margin-bottom: 16px;
    padding: 0 8px;

    line-height: 20px;

    border-radius: 5px;

    :hover {
        cursor: text;
    }
`;

export default RHSAboutDescription;
