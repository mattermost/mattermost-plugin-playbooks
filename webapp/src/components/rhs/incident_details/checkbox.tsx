// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import uniqueId from 'lodash/uniqueId';

interface Props {
    checked?: boolean;
    text: string;
    onChange?: (isChecked: boolean) => void;
}

type State = {
    uniqueId: string;
}

export default class Checkbox extends React.PureComponent<Props, State> {
    public state: State = {
        uniqueId: uniqueId(),
    };

    public handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (this.props.onChange) {
            this.props.onChange(event.target.checked);
        }
    }

    public render(): JSX.Element {
        return (
            <div className='checkbox-container'>
                <input
                    className='checkbox'
                    type='checkbox'
                    id={this.state.uniqueId}
                    checked={this.props.checked}
                    onChange={this.handleOnChange}
                />
                <label htmlFor={this.state.uniqueId}>{this.props.text}</label>
            </div>
        );
    }
}
