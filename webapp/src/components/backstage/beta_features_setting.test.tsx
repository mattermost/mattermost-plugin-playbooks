// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {ReactTestRendererJSON, act} from 'react-test-renderer';

import BetaFeaturesSetting from './beta_features_setting';

jest.mock('react-intl', () => ({
    useIntl: () => ({
        formatMessage: () => 'translated',
    }),
}));

describe('BetaFeaturesSetting', () => {
    const baseProps = {
        id: 'BetaFeatures',
        disabled: false,
        onChange: jest.fn(),
        setSaveNeeded: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders collapsed accordion by default', () => {
        const component = renderer.create(
            <BetaFeaturesSetting
                {...baseProps}
                value={{task_requirements: false}}
            />,
        );
        const tree = component.toJSON() as ReactTestRendererJSON;
        expect(tree.props['data-testid']).toBe('beta-features-accordion');
        expect(JSON.stringify(tree)).toContain('translated');
        expect(JSON.stringify(tree)).not.toContain('beta-feature-task-requirements');
    });

    it('expands and toggles task requirements', () => {
        const onChange = jest.fn();
        const setSaveNeeded = jest.fn();
        const component = renderer.create(
            <BetaFeaturesSetting
                {...baseProps}
                onChange={onChange}
                setSaveNeeded={setSaveNeeded}
                value={{task_requirements: false}}
            />,
        );

        const header = component.root.findByProps({'aria-expanded': false});
        act(() => {
            header.props.onClick();
        });

        const checkbox = component.root.findByProps({'data-testid': 'beta-feature-task-requirements'});
        expect(checkbox.props.checked).toBe(false);

        act(() => {
            checkbox.props.onChange();
        });

        expect(onChange).toHaveBeenCalledWith('BetaFeatures', {task_requirements: true});
        expect(setSaveNeeded).toHaveBeenCalled();
    });
});
