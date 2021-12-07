// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled from 'styled-components';

import {useClickOutsideRef} from 'src/hooks';
import {StyledTextarea} from 'src/components/backstage/styles';

interface Props {
    stopEditing: () => void;
    initialText: string;
    onEdit: (text: string) => void;
}

const ReportTextArea = ({stopEditing, initialText, onEdit}: Props) => {
    const textareaRef = useRef(null);
    const [text, setText] = useState(initialText);
    useClickOutsideRef(textareaRef, stopEditing);

    return (
        <StyledTextArea
            ref={textareaRef}
            autoFocus={true}
            onFocus={(e) => {
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
            }}
            value={text}
            onChange={(e) => {
                setText(e.target.value);
                onEdit(e.target.value);
            }}
        />
    );
};

const StyledTextArea = styled(StyledTextarea)`
    margin: 8px 0 0 0;
    min-height: 200px;
    font-size: 12px;
    flex-grow: 1;
`;

export default ReportTextArea;
