// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {CategorizeChannelPayload, ChannelAction, ChannelActionType, PromptRunPlaybookFromKeywordsPayload, WelcomeMessageActionPayload} from 'src/types/channel_actions';

import {usePlaybooksCrud} from 'src/hooks';

import MarkdownTextbox from 'src/components/markdown_textbox';
import {StyledSelect} from 'src/components/backstage/styles';
import CategorySelector from 'src/components/backstage/category_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    action: ChannelAction;
    onUpdate: (action: ChannelAction) => void;
    editable: boolean;
}

const ActionChildren = (props: Props) => {
    switch (props.action.action_type) {
    case ChannelActionType.WelcomeMessage:
        return <WelcomeActionChildren {...props}/>;
    case ChannelActionType.PromptRunPlaybook:
        return <RunPlaybookChildren {...props}/>;
    case ChannelActionType.CategorizeChannel:
        return <CategorizeChannelChildren {...props}/>;
    }

    return null;
};

const WelcomeActionChildren = ({action, onUpdate, editable}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <MarkdownTextbox
            placeholder={formatMessage({defaultMessage: 'Define a message to welcome users joining the channel.'})}
            value={(action.payload as WelcomeMessageActionPayload).message}
            setValue={(newMessage: string) => {
                onUpdate({
                    ...action,
                    payload: {message: newMessage} as WelcomeMessageActionPayload,
                });
            }}
            id={'channel-actions-modal_welcome-msg'}
            hideHelpText={true}
            previewByDefault={!editable}
            disabled={!editable}
        />
    );
};

const RunPlaybookChildren = ({action, onUpdate, editable}: Props) => {
    const {formatMessage} = useIntl();
    const [playbooks] = usePlaybooksCrud({sort: 'title'}, {infinitePaging: true});

    const playbookOptions = playbooks?.map((playbook) => (
        {
            value: playbook.title,
            label: playbook.title,
            id: playbook.id,
        }
    ));

    const payload = action.payload as PromptRunPlaybookFromKeywordsPayload;

    const onSelectedChange = ({id}: {id: string}) => {
        onUpdate({
            ...action,
            payload: {
                ...action.payload,
                playbook_id: id,
            },
        });
    };

    return (
        <StyledSelect
            placeholder={formatMessage({defaultMessage: 'Select a playbook'})}
            onChange={onSelectedChange}
            options={playbookOptions || []}
            value={playbookOptions?.find((p) => p.id === payload.playbook_id)}
            isClearable={false}
            maxMenuHeight={250}
            styles={{indicatorSeparator: () => null}}
            isDisabled={!editable}
        />
    );
};

const CategorizeChannelChildren = ({action, onUpdate, editable}: Props) => {
    const {formatMessage} = useIntl();
    const payload = action.payload as CategorizeChannelPayload;

    const onCategorySelected = (name: string) => {
        onUpdate({
            ...action,
            payload: {
                ...action.payload,
                category_name: name,
            },
        });
    };

    return (
        <CategorySelector
            id='channel-actions-categorize-playbook-run'
            onCategorySelected={onCategorySelected}
            categoryName={payload.category_name}
            isClearable={true}
            selectComponents={{ClearIndicator, IndicatorSeparator: () => null}}
            isDisabled={!editable}
            captureMenuScroll={false}
            shouldRenderValue={true}
            placeholder={formatMessage({defaultMessage: 'Enter category name'})}
            menuPlacement={'bottom'}
        />
    );
};

export default ActionChildren;
