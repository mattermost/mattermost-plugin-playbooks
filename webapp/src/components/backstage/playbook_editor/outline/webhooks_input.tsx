// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {useClientRect} from 'src/hooks';
import Dropdown from 'src/components/dropdown';
import {CancelSaveButtons} from 'src/components/checklist_item/inputs';

import {Placeholder} from './update_timer_selector';
import {moveRect} from './broadcast_channels_selector';

type Props = {
    webhookOnStatusUpdateURLs: string[];
    onChange: (newWebhookOnStatusUpdateURLs: string[]) => void;
    errorText?: string;
    rows?: number;
    maxRows?: number;
    maxErrorText?: string;
    maxLength?: number;
}

export const WebhooksInput = (props: Props) => {
    const {formatMessage} = useIntl();
    const [invalid, setInvalid] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string>(props.errorText || formatMessage({defaultMessage: 'Invalid webhook URLs'}));
    const [urls, setURLs] = useState<string[]>(props.webhookOnStatusUpdateURLs);

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const onChange = async (newURLs: string) => {
        setURLs(newURLs.split('\n'));
    };

    // Decide where to open the datetime selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        moveRect(rect, props.webhookOnStatusUpdateURLs.length, setMoveUp);
    }, [rect, props.webhookOnStatusUpdateURLs.length]);

    const target = (
        <div ref={ref}>
            <div onClick={toggleOpen}>
                <Placeholder label={String(props.webhookOnStatusUpdateURLs.length) + ' outgoing webhook'}/>
            </div>
        </div>
    );

    const isValid = (newURLs: string): boolean => {
        const maxRows = props.maxRows || 64;
        const maxErrorText = props.maxErrorText || formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'});
        const errorTextTemp = props.errorText || formatMessage({defaultMessage: 'Invalid webhook URLs'});

        if (newURLs.split('\n').filter((v) => v.trim().length > 0).length > maxRows) {
            setInvalid(true);
            setErrorText(maxErrorText);
            return false;
        }

        if (!isPatternValid(newURLs, 'https?://.*', '\n')) {
            setInvalid(true);
            setErrorText(errorTextTemp);
            return false;
        }

        setInvalid(false);
        return true;
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={target}
            showOnRight={false}
            moveUp={moveUp}
        >
            <SelectorWrapper>
                <TextArea
                    disabled={false}
                    required={true}
                    rows={props.rows || 3}
                    value={urls.join('\n')}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={(e) => isValid(e.target.value)}
                    placeholder={formatMessage({defaultMessage: 'Enter webhook'})}
                    maxLength={props.maxLength || 1000}
                    invalid={invalid}
                />
                <ErrorMessage>
                    {errorText}
                </ErrorMessage>
                <Hint>
                    {formatMessage({defaultMessage: 'Enter one webhook per line'})}
                </Hint>
                <CancelSaveButtons
                    onCancel={() => {
                        setOpen(false);
                    }}
                    onSave={() => {
                        const filteredURLs = urls.filter((v) => v.trim().length > 0);
                        if (isValid(filteredURLs.join('\n'))) {
                            props.onChange(filteredURLs);
                            setOpen(false);
                        }
                    }}
                />
            </SelectorWrapper>
        </Dropdown>
    );
};

export default WebhooksInput;

const isPatternValid = (value: string, pattern: string, delimiter = '\n'): boolean => {
    const regex = new RegExp(pattern);
    const trimmed = value.split(delimiter).filter((v) => v.trim().length);
    const invalid = trimmed.filter((v) => !regex.test(v));
    return invalid.length === 0;
};

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    display: none;
`;

const SelectorWrapper = styled.div`
    margin: 0;
    width: 400px;
    min-height: 40px;
    padding: 16px;

    box-sizing: border-box;
    box-shadow: 0px 20px 32px rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    background: var(--center-channel-bg);
    border: 1px solid var(--center-channel-color-16);
`;

interface TextAreaProps {
    invalid: boolean;
}

const TextArea = styled.textarea<TextAreaProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }

    height: auto;
    width: 100%;
    padding: 10px 16px;

    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    border: 2px solid var(--button-bg);
    box-sizing: border-box;
    border-radius: 4px;

    font-size: 14px;
    line-height: 20px;
    resize: none;

    ${(props) => props.invalid && props.value && css`
        :not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);
            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;

const Hint = styled.div`
    margin: 6px 0px;

    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    color: var(--center-channel-color-64);
`;