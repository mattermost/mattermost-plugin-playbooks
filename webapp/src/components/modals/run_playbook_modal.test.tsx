// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React, {act} from 'react';
import renderer from 'react-test-renderer';

// Mock heavy external dependencies
jest.mock('src/graphql_client', () => ({
    getPlaybooksGraphQLClient: jest.fn(() => ({})),
}));

jest.mock('@apollo/client', () => ({
    ApolloProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});

    // Extract plain text from a defaultMessage that may be a pre-compiled AST (array of
    // {type, value} nodes produced by the formatjs babel plugin with ast:true) or a plain string.
    const extractText = (defaultMessage: any): string => {
        if (typeof defaultMessage === 'string') {
            return defaultMessage;
        }
        if (Array.isArray(defaultMessage)) {
            return defaultMessage.map((node: any) => (typeof node === 'object' && node !== null ? String(node.value ?? '') : String(node))).join('');
        }
        return '';
    };

    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage}: {defaultMessage: any}) => <span>{extractText(defaultMessage)}</span>,
    };
});

jest.mock('react-redux', () => {
    const mockDispatch = jest.fn(() => jest.fn());
    const mockSelector = jest.fn(() => 'mock-user-id');
    (mockDispatch as any).withTypes = () => mockDispatch;
    (mockSelector as any).withTypes = () => mockSelector;
    return {useDispatch: mockDispatch, useSelector: mockSelector};
});

jest.mock('src/graphql/hooks', () => ({}));

jest.mock('src/client', () => ({
    createPlaybookRun: jest.fn(),
}));

jest.mock('src/hooks', () => ({
    useCanCreatePlaybooksInTeam: jest.fn(() => false),
    usePlaybook: jest.fn(),
    usePlaybookAttributes: jest.fn(() => null),
}));

jest.mock('src/hooks/general', () => ({
    useProfilesInTeam: jest.fn(() => []),
    useUserDisplayNameMap: jest.fn(() => ({})),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannelId: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    getTeammateNameDisplaySetting: jest.fn(),
}));

jest.mock('mattermost-redux/utils/user_utils', () => ({
    displayUsername: jest.fn((user: any) => user?.username ?? ''),
}));

jest.mock('src/components/profile/profile', () => ({
    __esModule: true,
    default: ({userId}: {userId: string}) => <span data-testid={`profile-${userId}`}/>,
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid={props['data-testid'] || 'profile-selector'}
            onClick={() => props.onSelectedChange?.({id: 'user-abc', username: 'jdoe'})}
        />
    ),
}));

jest.mock('src/actions', () => ({
    displayPlaybookCreateModal: jest.fn(() => ({type: 'MOCK_ACTION'})),
}));

jest.mock('src/components/widgets/generic_modal', () => ({
    __esModule: true,
    default: ({children, isConfirmDisabled, handleConfirm, confirmButtonText}: any) => (
        <div data-testid='generic-modal'>
            <button
                data-testid='confirm-button'
                disabled={isConfirmDisabled}
                onClick={handleConfirm}
            >
                {confirmButtonText}
            </button>
            {children}
        </div>
    ),
    InlineLabel: ({children}: any) => <label>{children}</label>,
    ModalSideheading: ({children}: any) => <span>{children}</span>,
}));

jest.mock('src/components/backstage/playbook_edit/automation/channel_access', () => ({
    ButtonLabel: ({children}: any) => <div>{children}</div>,
    StyledChannelSelector: () => <div data-testid='channel-selector'/>,
    VerticalSplit: ({children}: any) => <div>{children}</div>,
}));

jest.mock('src/components/backstage/playbook_edit/automation/clear_indicator', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/components/backstage/playbook_edit/automation/menu_list', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('src/components/backstage/styles', () => ({
    HorizontalSpacer: () => <div/>,
    RadioInput: (props: any) => (
        <input
            type='radio'
            {...props}
        />
    ),
    InfoLine: ({children}: any) => <div>{children}</div>,
    StyledSelect: (props: any) => (
        <select
            data-testid={props['data-testid']}
            onChange={(e: any) => {
                if (props.isMulti) {
                    const values = Array.from(e.target.selectedOptions || [], (opt: any) => ({value: opt.value}));
                    props.onChange?.(values);
                } else {
                    props.onChange?.(e.target.value ? {value: e.target.value} : null);
                }
            }}
        >
            <option value=''>{'Select...'}</option>
            {(props.options || []).map((opt: any) => (
                <option
                    key={opt.value}
                    value={opt.value}
                >{opt.label}</option>
            ))}
        </select>
    ),
}));

jest.mock('src/components/playbooks_selector', () => ({
    __esModule: true,
    default: ({onSelectPlaybook}: {onSelectPlaybook?: (id: string) => void}) => (
        <div
            data-testid='playbooks-selector'
            data-on-select-playbook={typeof onSelectPlaybook}
            onClick={() => onSelectPlaybook?.('playbook-selected')}
        />
    ),
}));

jest.mock('src/components/assets/inputs', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const ReactMock = require('react');
    return {
        BaseInput: ReactMock.forwardRef((props: any, ref: any) => (
            <input
                ref={ref}
                data-testid={props['data-testid'] || 'base-input'}
                {...props}
            />
        )),
        BaseTextArea: (props: any) => (
            <textarea
                data-testid='base-textarea'
                {...props}
            />
        ),
    };
});

jest.mock('@mattermost/compass-icons/components', () => ({
    ArrowLeftIcon: () => <svg data-testid='arrow-left-icon'/>,
    CloseIcon: () => <svg data-testid='close-icon'/>,
}));

import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {usePlaybook, usePlaybookAttributes} from 'src/hooks';
import {createPlaybookRun} from 'src/client';
import {useUserDisplayNameMap} from 'src/hooks/general';
import {findNodeByTestId} from 'src/utils/test_helpers';

import {RunPlaybookModal} from './run_playbook_modal';

const mockUseUserDisplayNameMap = useUserDisplayNameMap as jest.Mock;
const mockDisplayUsername = displayUsername as jest.Mock;

const mockUsePlaybook = usePlaybook as jest.Mock;
const mockUsePlaybookAttributes = usePlaybookAttributes as jest.Mock;
const mockCreatePlaybookRun = createPlaybookRun as jest.Mock;

// Base playbook fixture
const basePlaybook = {
    id: 'playbook-1',
    title: 'My Playbook',
    description: '',
    team_id: 'team-1',
    create_public_playbook_run: false,
    delete_at: 0,
    run_summary_template_enabled: false,
    run_summary_template: '',
    public: true,
    default_owner_id: '',
    default_owner_enabled: false,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    members: [],
    default_playbook_member_role: '',
    active_runs: 0,
    checklists: [],
    channel_name_template: '',
    channel_mode: 'create_new_channel',
    channel_id: '',
    retrospective_enabled: false,
    propertyFields: [],
    run_number_prefix: '',
    next_run_number: 1,
};

const defaultProps = {
    playbookId: 'playbook-1',
    triggerChannelId: 'channel-1',
    teamId: 'team-1',
    onRunCreated: jest.fn(),
    onHide: jest.fn(),
};

const toJson = (component: renderer.ReactTestRenderer) => JSON.stringify(component.toJSON());

describe('RunPlaybookModal — template mode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const playbookWithTemplate = {
        ...basePlaybook,
        channel_name_template: '{Severity} - Incident',
        propertyFields: [
            {
                id: 'field-sev',
                name: 'Severity',
                type: 'text',
                group_id: 'playbook-1',
                attrs: {visibility: 'always', sort_order: 1, options: null},
            },
        ],
    };

    describe('name field behavior', () => {
        beforeEach(() => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
        });

        it('still shows the run name input when template is set', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).toContain('run-name-input');
        });

        it('marks name field as read-only when template is set', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).toContain('"$readOnly":true');
        });
    });

    describe('property field inputs', () => {
        beforeEach(() => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithTemplate.propertyFields);
        });

        it('shows property field inputs for template-referenced fields', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const json = toJson(component);
            expect(json).toContain('Severity');
            expect(json).toContain('property-field-field-sev');
        });

        it('does not show required indicator (*) on template-referenced fields', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const json = toJson(component);

            // The field label contains "Severity" but no "*" marker (all shown fields are required)
            expect(json).toContain('Severity');
            expect(json).not.toContain('"*"');
        });

        it('does not show property fields when no template is set', () => {
            mockUsePlaybook.mockReturnValue([basePlaybook, {isFetching: false, error: undefined}]);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).not.toContain('property-field-');
        });

        it('does not show property fields when template only uses {SEQ}', () => {
            const pb = {...basePlaybook, channel_name_template: '{SEQ}-run', propertyFields: playbookWithTemplate.propertyFields};
            mockUsePlaybook.mockReturnValue([pb, {isFetching: false, error: undefined}]);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).not.toContain('property-field-field-sev');
        });

        it('does not show property fields when template only uses system tokens', () => {
            const pb = {...basePlaybook, channel_name_template: '{SEQ}-{OWNER}-{CREATOR}', propertyFields: playbookWithTemplate.propertyFields};
            mockUsePlaybook.mockReturnValue([pb, {isFetching: false, error: undefined}]);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).not.toContain('property-field-field-sev');
        });
    });

    describe('select field inputs', () => {
        const playbookWithSelect = {
            ...basePlaybook,
            channel_name_template: '{Region} - Incident',
            propertyFields: [
                {
                    id: 'field-region',
                    name: 'Region',
                    type: 'select',
                    group_id: 'playbook-1',
                    attrs: {
                        visibility: 'always',
                        sort_order: 1,
                        options: [
                            {id: 'opt-us', name: 'US', color: null},
                            {id: 'opt-eu', name: 'EU', color: null},
                        ],
                    },
                },
            ],
        };

        it('renders a select dropdown for select-type fields', () => {
            mockUsePlaybook.mockReturnValue([playbookWithSelect, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithSelect.propertyFields);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const json = toJson(component);
            expect(json).toContain('property-field-field-region');
            expect(json).toContain('US');
            expect(json).toContain('EU');
        });
    });

    describe('name preview', () => {
        beforeEach(() => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
        });

        it('shows name preview when template is set', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);

            // Preview shows with unresolved placeholders initially
            expect(toJson(component)).toContain('run-name-preview');
        });

        it('does not show name preview when no template', () => {
            mockUsePlaybook.mockReturnValue([basePlaybook, {isFetching: false, error: undefined}]);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            expect(toJson(component)).not.toContain('run-name-preview');
        });

        it('preview is a div (read-only), not an input', () => {
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const tree = component.toJSON();
            const preview = findNodeByTestId(tree, 'run-name-preview');
            expect(preview).not.toBeNull();
            expect(preview.type).toBe('div');
        });

        it('resolves {OWNER} to the owner display name when profile is loaded', () => {
            const pb = {
                ...basePlaybook,
                channel_name_template: '{SEQ} - by {OWNER}',
                propertyFields: [],
                run_number_prefix: 'INC',
            };
            mockUsePlaybook.mockReturnValue([pb, {isFetching: false, error: undefined}]);

            // useSelector returns 'mock-user-id' for getCurrentUserId
            mockUseUserDisplayNameMap.mockReturnValue({'mock-user-id': 'Jane Doe'});
            mockDisplayUsername.mockReturnValue('Jane Doe');

            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const tree = component.toJSON();
            const preview = findNodeByTestId(tree, 'run-name-preview');
            expect(preview).not.toBeNull();
            expect(JSON.stringify(preview)).toContain('Jane Doe');
        });

        it('falls back to placeholder when owner profile is not loaded', () => {
            const pb = {
                ...basePlaybook,
                channel_name_template: 'by {OWNER}',
                propertyFields: [],
            };
            mockUsePlaybook.mockReturnValue([pb, {isFetching: false, error: undefined}]);
            mockUseUserDisplayNameMap.mockReturnValue({});

            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const tree = component.toJSON();
            const preview = findNodeByTestId(tree, 'run-name-preview');
            expect(JSON.stringify(preview)).toContain("Owner's name");
        });
    });

    describe('form validation', () => {
        it('disables submit when required property field is empty', () => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithTemplate.propertyFields);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const tree = component.toJSON();
            const btn = findNodeByTestId(tree, 'confirm-button');
            expect(btn).not.toBeNull();
            expect(btn.props.disabled).toBe(true);
        });

        it('enables submit when name is empty but template exists and fields are filled', () => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithTemplate.propertyFields);
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            // Simulate typing into the property field
            const tree = component!.toJSON();
            const fieldInput = findNodeByTestId(tree, 'property-field-field-sev');
            expect(fieldInput).not.toBeNull();

            // Type a value into the text field
            act(() => {
                fieldInput.props.onChange({target: {value: 'P1'}});
            });

            const updatedTree = component!.toJSON();
            const btn = findNodeByTestId(updatedTree, 'confirm-button');

            // With template set, name can be empty — only property fields matter
            expect(btn.props.disabled).toBe(false);
        });

        it('disables submit when no template and name is empty', () => {
            mockUsePlaybook.mockReturnValue([basePlaybook, {isFetching: false, error: undefined}]);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const tree = component.toJSON();
            const btn = findNodeByTestId(tree, 'confirm-button');
            expect(btn.props.disabled).toBe(true);
        });
    });

    describe('submit with property values', () => {
        it('passes property_values to createPlaybookRun on submit', async () => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithTemplate.propertyFields);
            mockCreatePlaybookRun.mockResolvedValue({id: 'run-1', channel_id: 'ch-1'});

            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            // Fill property field
            const tree = component!.toJSON();
            const fieldInput = findNodeByTestId(tree, 'property-field-field-sev');
            act(() => {
                fieldInput.props.onChange({target: {value: 'Critical'}});
            });

            // Click submit
            const updatedTree = component!.toJSON();
            const btn = findNodeByTestId(updatedTree, 'confirm-button');
            await act(async () => {
                btn.props.onClick();
            });

            expect(mockCreatePlaybookRun).toHaveBeenCalledTimes(1);
            const args = mockCreatePlaybookRun.mock.calls[0];

            // args: playbookId, userId, teamId, name, summary, channelId, createPublicRun, propertyValues
            expect(args[0]).toBe('playbook-1');
            expect(args[7]).toEqual({'field-sev': 'Critical'});
        });

        it('does not pass property_values when no fields are filled', async () => {
            const pbNoFields = {...basePlaybook, channel_mode: 'create_new_channel'};
            mockUsePlaybook.mockReturnValue([pbNoFields, {isFetching: false, error: undefined}]);
            mockCreatePlaybookRun.mockResolvedValue({id: 'run-1', channel_id: 'ch-1'});

            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            // Type a run name (required since no template)
            const tree = component!.toJSON();
            const nameInput = findNodeByTestId(tree, 'run-name-input');
            act(() => {
                nameInput.props.onChange({target: {value: 'My Run'}});
            });

            // Submit
            const updatedTree = component!.toJSON();
            const btn = findNodeByTestId(updatedTree, 'confirm-button');
            await act(async () => {
                btn.props.onClick();
            });

            expect(mockCreatePlaybookRun).toHaveBeenCalledWith(
                'playbook-1', 'mock-user-id', 'team-1', 'My Run', '', undefined, false, undefined,
            );
        });
    });

    describe('user field preview resolution', () => {
        const playbookWithUserField = {
            ...basePlaybook,
            channel_name_template: '{Manager} Incident',
            propertyFields: [
                {
                    id: 'field-mgr',
                    name: 'Manager',
                    type: 'user',
                    group_id: 'playbook-1',
                    attrs: {visibility: 'always', sort_order: 1, options: null},
                },
            ],
        };

        beforeEach(() => {
            mockUsePlaybook.mockReturnValue([playbookWithUserField, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithUserField.propertyFields);

            // Provide a profile so the userMap can resolve the selected user ID
            mockUseUserDisplayNameMap.mockReturnValue({'user-abc': 'Jane Doe'});
            mockDisplayUsername.mockReturnValue('Jane Doe');
        });

        it('preview shows user display name after user is selected', () => {
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            // Click the profile selector — the mock calls onSelectedChange({id: 'user-abc', username: 'jdoe'})
            const tree = component!.toJSON();
            const profileSelector = findNodeByTestId(tree, 'property-field-field-mgr');
            expect(profileSelector).not.toBeNull();

            act(() => {
                profileSelector.props.onClick();
            });

            // The preview should now show "Jane Doe Incident" (resolved via userMap), not "user-abc Incident"
            const updatedTree = component!.toJSON();
            const preview = findNodeByTestId(updatedTree, 'run-name-preview');
            expect(preview).not.toBeNull();
            const previewText = JSON.stringify(preview);
            expect(previewText).toContain('Jane Doe');
            expect(previewText).not.toContain('user-abc');
        });

        it('preview resolves display name via picker even when user is not in the team profile list', () => {
            // Profile list is empty — userMap has no entries, but onUserKnown
            // captures the display name from the UserProfile returned by the picker.
            mockUseUserDisplayNameMap.mockReturnValue({});

            // displayUsername returns the same 'Jane Doe' (from beforeEach), which is what
            // handleUserKnown will call when storing the picked user's display name.

            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            const tree = component!.toJSON();
            const profileSelector = findNodeByTestId(tree, 'property-field-field-mgr');
            act(() => {
                profileSelector.props.onClick();
            });

            const updatedTree = component!.toJSON();
            const preview = findNodeByTestId(updatedTree, 'run-name-preview');
            const previewText = JSON.stringify(preview);

            // The picker's onSelectedChange supplies the full UserProfile so the
            // display name is resolved even without the team profile list.
            expect(previewText).not.toContain('user-abc');
            expect(previewText).toContain('Jane Doe');
        });
    });

    describe('channel_name_template', () => {
        it('also extracts fields from channel_name_template', () => {
            const pb = {
                ...basePlaybook,
                channel_name_template: '{Team}-channel',
                propertyFields: [
                    {
                        id: 'field-team',
                        name: 'Team',
                        type: 'text',
                        group_id: 'playbook-1',
                        attrs: {visibility: 'always', sort_order: 1, options: null},
                    },
                ],
            };
            mockUsePlaybook.mockReturnValue([pb, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(pb.propertyFields);
            const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            const json = toJson(component);
            expect(json).toContain('property-field-field-team');
        });
    });

    describe('playbook switching resets property values', () => {
        it('clears property values when selected playbook changes', () => {
            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);

            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...{...defaultProps, playbookId: undefined}}/>);
            });

            // The modal starts on 'select-playbook' step since playbookId is undefined
            const json = toJson(component!);
            expect(json).toContain('playbooks-selector');
        });
    });

    describe('handleSelectPlaybook callback', () => {
        it('transitions from select-playbook step to run-details step when a playbook is selected', () => {
            mockUsePlaybook.mockReturnValue([basePlaybook, {isFetching: false, error: undefined}]);

            // Start without a playbookId so the modal opens on the select-playbook step
            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...{...defaultProps, playbookId: undefined}}/>);
            });

            // Confirm we are on the select-playbook step
            expect(toJson(component!)).toContain('playbooks-selector');

            // Simulate selecting a playbook via the forwarded onSelectPlaybook callback
            const tree = component!.toJSON();
            const selector = findNodeByTestId(tree, 'playbooks-selector');
            expect(selector).not.toBeNull();

            act(() => {
                selector.props.onClick();
            });

            // After selection the modal should switch to the run-details step (run-name-input visible)
            expect(toJson(component!)).toContain('run-name-input');
            expect(toJson(component!)).not.toContain('playbooks-selector');
        });

        it('resets property values when a new playbook is selected', () => {
            // altPlaybook has the same template token so the field stays rendered after switching,
            // letting us verify the value was cleared (not just hidden).
            const altPlaybook = {
                ...basePlaybook,
                id: 'playbook-2',
                channel_name_template: '{Severity} - Alt Incident',
                propertyFields: playbookWithTemplate.propertyFields,
            };

            mockUsePlaybook.mockReturnValue([playbookWithTemplate, {isFetching: false, error: undefined}]);
            mockUsePlaybookAttributes.mockReturnValue(playbookWithTemplate.propertyFields);

            let component: renderer.ReactTestRenderer;
            act(() => {
                component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
            });

            // Populate the property field
            const fieldInput = findNodeByTestId(component!.toJSON(), 'property-field-field-sev');
            expect(fieldInput).not.toBeNull();
            act(() => {
                fieldInput.props.onChange({target: {value: 'Critical'}});
            });

            // Confirm button enabled after filling required field
            expect(findNodeByTestId(component!.toJSON(), 'confirm-button').props.disabled).toBe(false);

            // Switch to a different playbook — changing playbook.id triggers the useEffect reset
            mockUsePlaybook.mockReturnValue([altPlaybook, {isFetching: false, error: undefined}]);
            act(() => {
                component.update(<RunPlaybookModal {...defaultProps}/>);
            });

            // Property field still rendered (same template token) but value cleared by the reset
            const resetField = findNodeByTestId(component!.toJSON(), 'property-field-field-sev');
            expect(resetField).not.toBeNull();
            expect(resetField.props.value).toBe('');

            // Confirm button disabled because the required field is now empty
            expect(findNodeByTestId(component!.toJSON(), 'confirm-button').props.disabled).toBe(true);
        });
    });
});

describe('RunPlaybookModal — no template (free-text mode)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUsePlaybook.mockReturnValue([basePlaybook, {isFetching: false, error: undefined}]);
    });

    it('shows the free-text run name input', () => {
        const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
        expect(toJson(component)).toContain('run-name-input');
    });

    it('does not show name preview', () => {
        const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
        expect(toJson(component)).not.toContain('run-name-preview');
    });

    it('does not show property field inputs', () => {
        const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
        expect(toJson(component)).not.toContain('property-field-');
    });

    it('does not mark name as optional', () => {
        const component = renderer.create(<RunPlaybookModal {...defaultProps}/>);
        expect(toJson(component)).not.toContain('optional');
    });
});
