
import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, components} from 'react-select';

import {UserProfile} from 'mattermost-redux/types/users';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import ProfileSelector from 'src/components/profile/profile_selector';

import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {useClickOutsideRef, useProfilesInCurrentChannel, useTimeout, useProfilesInTeam} from 'src/hooks';
import {
    setAssignee,
} from 'src/client';
interface CheckBoxButtonProps {
    onChange: (item: ChecklistItemState) => void;
    item: ChecklistItem;
    disabled: boolean;
}

export const CheckBoxButton = (props: CheckBoxButtonProps) => {
    const isChecked = props.item.state === ChecklistItemState.Closed;

    return (
        <ChecklistItemInput
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            disabled={props.disabled}
            onChange={() => {
                if (isChecked) {
                    props.onChange(ChecklistItemState.Open);
                } else {
                    props.onChange(ChecklistItemState.Closed);
                }
            }}
        />);
};

const ChecklistItemInput = styled.input`
    :disabled:hover {
        cursor: default;
    }
`;

export const CollapsibleChecklistItemDescription = (props: {expanded: boolean, children: React.ReactNode}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    let computedHeight = 'auto';
    if (ref?.current) {
        computedHeight = ref.current.scrollHeight + 'px';
    }

    return (
        <ChecklistItemDescription
            ref={ref}
            height={props.expanded ? computedHeight : '0'}
        >
            {props.children}
        </ChecklistItemDescription>
    );
};

const ChecklistItemDescription = styled.div<{height: string}>`
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    max-width: 630px;
    margin: 4px 0 0 35px;

    // Fix default markdown styling in the paragraphs
    p {
        :last-child {
            margin-bottom: 0;
        }

        white-space: pre-wrap;
    }
    height: ${({height}) => height};

    transition: height 0.2s ease-in-out;
    overflow: hidden;
`;
