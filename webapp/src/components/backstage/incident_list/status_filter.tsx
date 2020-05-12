// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import ReactSelect from 'react-select';

import './filter_button.scss';

interface Props {
    onChange: (newStatus: string) => void;
}

const options = [
    {value: 'Ongoing', label: 'Ongoing'},
    {value: 'Ended', label: 'Ended'},
    {value: 'All', label: 'All'},
];

const downChevron = <i className='icon-chevron-down ml-1 mr-2'/>;

export function StatusFilter(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [selected, setSelected] = useState('');

    const onSelectedChange = async (value: string) => {
        toggleOpen();
        if (value !== selected) {
            const newValue = value === 'All' ? '' : value;
            props.onChange(newValue);
            setSelected(newValue);
        }
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={
                <button
                    onClick={toggleOpen}
                    className='status-filter-button'
                >
                    {selected === '' ? 'Status' : selected}
                    {downChevron}
                </button>
            }
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={false}
                menuIsOpen={true}
                options={options}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                //value={selected}
                onChange={(option) => onSelectedChange(option.value)}
                classNamePrefix='status-filter-select'
                className='status-filter-select'
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

// styled components
interface DropdownProps {
    children: JSX.Element;
    isOpen: boolean;
    target: JSX.Element;
    onClose: () => void;
}

const Dropdown = ({children, isOpen, target, onClose}: DropdownProps) => (
    <div
        className={`status-filter-dropdown${isOpen ? ' status-filter-dropdown--active' : ''}`}
        css={{position: 'relative'}}
    >
        {target}
        {isOpen ? <Menu className='status-filter-select__container'>{children}</Menu> : null}
        {isOpen ? <Blanket onClick={onClose}/> : null}
    </div>
);

const Menu = (props: Record<string, any>) => {
    return (
        <div {...props}/>
    );
};

const Blanket = (props: Record<string, any>) => (
    <div
        css={{
            bottom: 0,
            left: 0,
            top: 0,
            right: 0,
            position: 'fixed',
            zIndex: 1,
        }}
        {...props}
    />
);

