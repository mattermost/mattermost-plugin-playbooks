
import React, {useRef} from 'react';
import styled from 'styled-components';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';

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

export const CancelSaveButtons = (props: {onCancel: () => void, onSave: () => void}) => {
    return (<CancelSaveContainer>
        <CancelButton
            onClick={props.onCancel}
        >
            {'Cancel'}
        </CancelButton>
        <SaveButton
            onClick={props.onSave}
        >
            {'Save'}
        </SaveButton>
    </CancelSaveContainer>
    );
};

const CancelSaveContainer = styled.div`
    text-align: right;
    padding: 8px;
    z-index: 2;
`;

const CancelButton = styled(SecondaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 4px;
    border-radius: 4px;
`;

const SaveButton = styled(PrimaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 4px;
    border-radius: 4px;
`;
