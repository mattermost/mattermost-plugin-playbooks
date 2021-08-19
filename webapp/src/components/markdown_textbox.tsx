// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent, ChangeEvent, useState} from 'react';

import Icon from '@mdi/react';
import {mdiOpenInNew} from '@mdi/js';
import classNames from 'classnames';
import {Link} from 'react-router-dom';
import styled from 'styled-components';

import {Textbox} from 'src/webapp_globals';

const DEFAULT_CHAR_LIMIT = 4000;

type MarkdownTextboxProps = {
    value: string;
    setValue: (val: string) => void;
    autocompleteChannelId: string;
    createMessage?: string;
    id: string;
    className?: string
}

const MarkdownTextbox = ({
    value,
    setValue,
    autocompleteChannelId,
    className,
    ...props
}: MarkdownTextboxProps) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <div className={className}>
            <Textbox
                tabIndex={0}
                value={value}
                emojiEnabled={true}
                supportsCommands={false}
                suggestionListPosition='bottom'
                preview={showPreview}
                useChannelMentions={false}
                channelId={autocompleteChannelId}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
                characterLimit={DEFAULT_CHAR_LIMIT}
                createMessage={''}
                onKeyPress={() => true}
                openWhenEmpty={true}
                {...props}
            />
            <StyledTextboxLinks
                characterLimit={DEFAULT_CHAR_LIMIT}
                showPreview={showPreview}
                updatePreview={setShowPreview}
                message={value}
            />
        </div>
    );
};

const StyledMarkdownTextbox = styled(MarkdownTextbox)`
    .textarea-wrapper {
        margin-bottom: 6px;
    }

    &&&& {
        .form-control.textbox-preview-area {
            background: rgba(var(--center-channel-color-rgb), 0.04);
        }
        .custom-textarea.custom-textarea {
            height: unset;
            min-height: 104px;
            max-height: 324px;
            overflow: auto;
            padding: 12px 30px 12px 16px;
        }
    }
`;

type TextboxLinksProps = {
    showPreview?: boolean;
    characterLimit: number;
    updatePreview?: (showPreview: boolean) => void;
    message: string;
    className?: string;
};

function TextboxLinks({
    message = '',
    characterLimit,
    showPreview,
    className,
    updatePreview,
}: TextboxLinksProps) {
    const togglePreview = (e: MouseEvent) => {
        e.preventDefault();
        updatePreview?.(!showPreview);
    };

    const hasText = message && message.length > 0;

    const helpText = (
        <Helpers>
            <b>
                {'**bold**'}
            </b>
            <i>
                {'*italic*'}
            </i>
            <span>
                {'~~'}
                <s>
                    {'strike'}
                </s>
                {'~~ '}
            </span>
            <span>
                {'`inline code`'}
            </span>
            <span>
                {'```preformatted```'}
            </span>
            <span>
                {'>quote'}
            </span>
        </Helpers>
    );

    return (
        <div
            className={classNames(className, {
                hidden: message?.length > characterLimit,
            })}
        >
            <div
                style={{visibility: hasText ? 'visible' : 'hidden', opacity: hasText ? '' : '0'}}
                className={'help__format-text'}
            >
                {helpText}
            </div>
            <div>
                <button
                    onClick={togglePreview}
                    className='style--none textbox-preview-link color--link'
                >
                    {showPreview ? 'Edit' : 'Preview'}
                </button>
                <Link
                    target='_blank'
                    rel='noopener noreferrer'
                    to='/help/formatting'
                    className='textbox-help-link'
                >
                    {'Help'}
                </Link>
            </div>
        </div>
    );
}

const StyledTextboxLinks = styled(TextboxLinks)`
    display: inline-flex;
    align-items: baseline;
    justify-content: space-between;
    width: 100%;

    a,
    button {
        margin-left: 10px;
        font-size: 1em;
        line-height: 18px;
    }

    .help__format-text {
        transition: opacity, 0.3s, ease-in, 0.3s;
        font-size: 0.85em;
        vertical-align: bottom;
        white-space: nowrap;
        opacity: 1;

        .modal & {
            white-space: normal;
        }
    }
`;

const Helpers = styled.span`
    opacity: 0.45;

    && {
        position: unset;
        top: unset;
        margin: unset;
    }

    b,
    i,
    span {
        position: relative;
        top: -1px;
        margin: 0 2px;
    }

    b {
        opacity: 0.9;
    }

    code {
        padding: 0;
        background: transparent;
    }
`;

export default StyledMarkdownTextbox;
