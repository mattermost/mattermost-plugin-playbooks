import React from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {Option} from 'react-select/src/filters';
import {useSelector} from 'react-redux';
import {makeGetCategoriesForTeam} from 'mattermost-redux/selectors/entities/channel_categories';

import {ChannelCategory} from 'mattermost-redux/types/channel_categories';
import {GlobalState} from 'mattermost-redux/types/store';

import {StyledCreatable} from './styles';

export interface Props {
    id?: string;
    onCategorySelected: (categoryName: string) => void;
    categoryName?: string;
    isClearable?: boolean;
    selectComponents?: SelectComponentsConfig<ChannelCategory>;
    isDisabled: boolean;
    captureMenuScroll: boolean;
    shouldRenderValue: boolean;
    placeholder?: string;
}

const getCategoriesForTeam = makeGetCategoriesForTeam();

const getMyCategories = (state: GlobalState) => getCategoriesForTeam(state, state.entities.teams.currentTeamId);

const CategorySelector = (props: Props & { className?: string }) => {
    const selectableCategories = useSelector(getMyCategories);

    const onChange = (option: ChannelCategory | Option, {action}: {action: string}) => {
        if (action === 'clear') {
            props.onCategorySelected('');
        } else if(action === 'create-option') {
            props.onCategorySelected((option as Option).value);
        } else {
            props.onCategorySelected((option as ChannelCategory).display_name);
        }
    };

    const getOptionValue = (category: ChannelCategory) => category.display_name;

    const getOptionLabel = (option: ChannelCategory | Option) => (option as ChannelCategory).display_name || (option as Option).label

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledCreatable
            className={props.className}
            id={props.id}
            controlShouldRenderValue={props.shouldRenderValue}
            options={selectableCategories}
            onChange={onChange}
            getOptionValue={getOptionValue}
            getOptionLabel={getOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={props.isClearable}
            value={props.categoryName}
            placeholder={props.placeholder || 'Add channel to category'}
            classNamePrefix='channel-selector'
            components={components}
            isDisabled={props.isDisabled}
            captureMenuScroll={props.captureMenuScroll}
        />
    );
};

export default CategorySelector;
