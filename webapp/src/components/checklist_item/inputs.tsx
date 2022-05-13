
import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {ClientError} from 'mattermost-redux/client/client4';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

interface CheckBoxButtonProps {
    onChange: (item: ChecklistItemState) => undefined | Promise<void | {error: ClientError}>;
    item: ChecklistItem;
    disabled: boolean;
}

export const CheckBoxButton = (props: CheckBoxButtonProps) => {
    const [isChecked, setIsChecked] = useState(props.item.state === ChecklistItemState.Closed);
    return (
        <ChecklistItemInput
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            disabled={props.disabled}
            onChange={async () => {
                // There are two reasons to use this optimistic update approach
                // 1 - avoid waiting 300ms to see how checkbox change in UI
                // 2 - if websocket fails, we'll still mark the checkbox correctly.
                //     Additionally in the same scenario, we prevent the user from
                //     clicking multiple times and leaving the item in an unknown state
                const newValue = isChecked ? ChecklistItemState.Open : ChecklistItemState.Closed;
                setIsChecked(!isChecked);
                const res = await props.onChange(newValue);
                if (res?.error) {
                    setIsChecked(isChecked);
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

    margin-left: 36px;
    padding-right: 8px;

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
    const {formatMessage} = useIntl();

    return (
        <CancelSaveContainer>
            <CancelButton
                onClick={props.onCancel}
            >
                {formatMessage({defaultMessage: 'Cancel'})}
            </CancelButton>
            <SaveButton
                onClick={props.onSave}
                data-testid='checklist-item-save-button'
            >
                {formatMessage({defaultMessage: 'Save'})}
            </SaveButton>
        </CancelSaveContainer>
    );
};

const CancelSaveContainer = styled.div`
    text-align: right;
    padding: 8px;
    z-index: 2;
    white-space: nowrap;
`;

const CancelButton = styled(TertiaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 2px;
    border-radius: 4px;
    font-size: 12px;
`;

const SaveButton = styled(PrimaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin: 0px 2px;
    border-radius: 4px;
    font-size: 12px;
`;
